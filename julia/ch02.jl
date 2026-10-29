# Chapter 2 -- Lopsided
#
#     cd julia
#     julia --project ch02.jl
#
# One function per figure; each writes its CSVs with write_csv(CH, "name", ...)
# or density_csv(CH, "name", xs, ...). Simulations draw from chapter_rng(CH; stream = k),
# one stream per figure, so results are identical on every run.

include("common.jl")

using DistributionsFactories
using XLSX
using ZipFile

const CH = 2
const RAW = joinpath(@__DIR__, "raw")   # downloaded by hand; ignored by git

# ——— Figure 2.1: managers vs data scientists (OEWS, May 2025) ———
#
# Source: BLS Occupational Employment and Wage Statistics, May 2025, national
# file oesm25nat.zip (https://www.bls.gov/oes/tables.htm), saved to julia/raw/.
# BLS blocks scripted downloads, so it is fetched by hand.
#
# OEWS publishes each occupation's mean and its 10th/25th/50th/75th/90th
# percentile annual wages, not the full distribution. We fit a lognormal through
# the 25th and 75th percentiles with DistributionsFactories.make_dist, then check
# it against the three percentiles and the mean it was NOT fitted to. The chart's
# markers use the published mean and median; the curve is the fitted shape.

const OEWS_ZIP = joinpath(RAW, "oesm25nat.zip")
const OCCUPATIONS = ["11-1021" => "managers", "15-2051" => "data_scientists"]
const PCTS = [0.10, 0.25, 0.50, 0.75, 0.90]

"Read the national OEWS rows for `codes` → Dict(code => (title, mean, percentiles))."
function load_oews(codes)
    isfile(OEWS_ZIP) || error("Download the May 2025 national OEWS file and save it as $OEWS_ZIP")
    reader = ZipFile.Reader(OEWS_ZIP)
    entry = only(filter(f -> endswith(f.name, ".xlsx"), reader.files))
    xlsx = tempname() * ".xlsx"
    write(xlsx, read(entry))
    close(reader)
    num(v) = v isa Number ? Float64(v) : parse(Float64, replace(string(v), "," => ""))
    out = Dict{String,Any}()
    XLSX.openxlsx(xlsx) do xf
        for row in XLSX.eachtablerow(xf[1])
            code = string(row[:OCC_CODE])
            code in codes || continue
            pct = num.([row[:A_PCT10], row[:A_PCT25], row[:A_MEDIAN], row[:A_PCT75], row[:A_PCT90]])
            out[code] = (title = string(row[:OCC_TITLE]), mean = num(row[:A_MEAN]), pct = pct)
        end
    end
    rm(xlsx)
    length(out) == length(codes) || error("Missing occupations: $(setdiff(codes, keys(out)))")
    return out
end

function fig_salaries()
    data = load_oews(first.(OCCUPATIONS))
    xs = range(0, 350_000; step = 500)
    curves = Pair{String,Any}[]
    names, values = String[], Float64[]
    stat!(k, v) = (push!(names, k); push!(values, v))
    geo = Tuple{String,String,String,String,String}[]
    for (code, key) in OCCUPATIONS
        d = data[code]
        q25, q75 = d.pct[2], d.pct[4]
        fit = make_dist(LogNormal; quantiles = [(0.25, q25), (0.75, q75)])
        # sanity check against the closed form: σ = log(q75/q25) / (2 z75)
        σ = log(q75 / q25) / (2 * quantile(Normal(), 0.75))
        isapprox(params(fit)[2], σ; rtol = 1e-6) || error("make_dist fit for $key differs from the closed form")
        fitted = quantile.(fit, PCTS)
        worst = maximum(abs.(fitted ./ d.pct .- 1))
        @printf("%-32s mean %s (fit %s, %+.1f%%)  median %s  worst percentile miss %.1f%%\n",
            d.title, fmt(round(Int, d.mean)), fmt(round(Int, mean(fit))), 100 * (mean(fit) / d.mean - 1),
            fmt(round(Int, d.pct[3])), 100 * worst)
        push!(curves, key => fit)
        stat!("$(key)_mean", d.mean)
        stat!("$(key)_median", d.pct[3])
        foreach((p, v) -> stat!("$(key)_p$(round(Int, 100p))", v), PCTS, d.pct)
        stat!("$(key)_fit_mean", mean(fit))
        stat!("$(key)_fit_mode", mode(fit))
        stat!("$(key)_worst_miss", worst)
        stat!("$(key)_share_below_mean", cdf(fit, d.mean))
        # The verdict table: published quartiles and median, and the quartile
        # ratio as a measure of spread (robust, and the same on any scale).
        dollars(x) = "\$" * string(round(Int, x / 1000)) * "K"
        label = Dict("managers" => "General and operations managers", "data_scientists" => "Data scientists")[key]
        q25, q50, q75 = d.pct[2], d.pct[3], d.pct[4]
        push!(geo, (label, dollars(q25), dollars(q50), dollars(q75), Printf.format(Printf.Format("%.1f×"), q75 / q25)))
    end
    density_csv(CH, "salaries", xs, curves...)
    write_csv(CH, "salaries-stats", "stat" => names, "value" => values)
    write_csv(CH, "salaries-geo-table", "Occupation" => [g[1] for g in geo], "25th" => [g[2] for g in geo],
        "Median" => [g[3] for g in geo], "75th" => [g[4] for g in geo], "75th ÷ 25th" => [g[5] for g in geo])
end

# ——— Home values (Census ACS 1-year PUMS, 2024) ———
#
# Source: U.S. Census Bureau, American Community Survey 2024 1-year Public Use
# Microdata Sample, via the Census microdata API (api.census.gov/data/2024/acs/acs1/pums).
# Set your key first:  ENV["CENSUS_API_KEY"]  (works without one for a few requests).
#
# VALP is the owner's own estimate of what the home would sell for (rounded and
# top-coded), so this is the value of owner-occupied homes, not that year's sale prices.
# We keep one record per home (SPORDER = 1, the householder), owner-occupied
# (TEN 1 = mortgage/loan, 2 = owned free and clear), one-family detached (BLD 2),
# and weight by the housing-unit weight WGTP.
#
# The density is a weighted Gaussian KDE on log(value), back-transformed to dollars,
# which handles the long right tail without a huge bandwidth in the middle.

using CSV
using Downloads
using JSON

const ACS_YEAR = 2024
const STATES = ["01","02","04","05","06","08","09","10","11","12","13","15","16","17","18","19","20",
    "21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39",
    "40","41","42","44","45","46","47","48","49","50","51","53","54","55","56"]   # 50 states + DC

"Fetch owner-occupied, one-family-detached home values for one state → (value, weight) vectors."
function acs_home_values(state)
    key = get(ENV, "CENSUS_API_KEY", "")
    url = "https://api.census.gov/data/$ACS_YEAR/acs/acs1/pums?get=VALP,WGTP,TEN,BLD,SPORDER&for=state:$state" *
          (isempty(key) ? "" : "&key=$key")
    # The API answers errors with an HTML page, not JSON: retry a few times, then
    # stop with the page's own message (a rejected key, a throttle, …).
    body = ""
    for attempt in 1:3
        body = String(take!(Downloads.download(url, IOBuffer())))
        startswith(lstrip(body), "[") && break
        attempt < 3 && sleep(5attempt)
    end
    if !startswith(lstrip(body), "[")
        msg = strip(replace(replace(body, r"<style[\s\S]*?</style>" => " ", r"<[^>]+>" => " "), r"\s+" => " "))
        error("Census API error for state $state" * (isempty(key) ? " (no CENSUS_API_KEY set)" : "") *
              ":\n  " * first(msg, 400))
    end
    rows = JSON.parse(body)
    header = String.(rows[1])
    col(name) = findfirst(==(name), header)
    iv, iw, it, ib, is = col("VALP"), col("WGTP"), col("TEN"), col("BLD"), col("SPORDER")
    num(x) = x isa Number ? Float64(x) : parse(Float64, string(x))
    vals, wts = Float64[], Float64[]
    for r in Iterators.drop(rows, 1)
        num(r[is]) == 1 || continue                     # one record per housing unit
        num(r[it]) in (1, 2) || continue                # owner-occupied
        num(r[ib]) == 2 || continue                     # one-family house, detached
        v = num(r[iv]); v > 0 || continue
        push!(vals, v); push!(wts, num(r[iw]))
    end
    return vals, wts
end

function wquantile(x, w, p)
    o = sortperm(x); cw = cumsum(w[o]) ./ sum(w)
    return x[o][searchsortedfirst(cw, p)]
end

function fig_home_values()
    cache = joinpath(RAW, "acs$(ACS_YEAR)_home_values.csv")
    # A cache from before the state column was added is fetched again.
    if isfile(cache) && :state in propertynames(CSV.File(cache; limit = 1))
        t = CSV.File(cache; types = Dict(:state => String)); vals, wts = Float64.(t.value), Float64.(t.weight)
    else
        mkpath(RAW)
        vals, wts = Float64[], Float64[]
        sts = String[]
        for s in STATES
            v, w = acs_home_values(s); append!(vals, v); append!(wts, w); append!(sts, fill(s, length(v)))
        end
        println("fetched $(length(vals)) home records from the Census API")
        # Cached with each record's state (FIPS code), so reruns skip the API.
        CSV.write(cache, (value = vals, weight = wts, state = sts))
    end
    W = sum(wts)
    μ = sum(vals .* wts) / W
    med = wquantile(vals, wts, 0.5)

    o = sortperm(vals); cw = cumsum(wts[o]) ./ W; sv = vals[o]
    share_below(x) = (i = searchsortedlast(sv, x); i == 0 ? 0.0 : cw[i])

    # Figure 2.3, dollar scale. Owners round their estimates (about half of all homes
    # sit at a multiple of $50,000), and the rounding is coarser at higher values, so
    # the kernel width grows with the value: max($40,000, 15% of the value). Values
    # are binned to $1,000 first for speed, and the kernel is reflected at $0.
    bins = zeros(10_000)
    for (v, wt) in zip(vals, wts)
        bins[min(length(bins), floor(Int, v / 1000) + 1)] += wt
    end
    keep = bins .> 0
    c = ((0:length(bins)-1) .* 1000 .+ 500.0)[keep]; b = bins[keep]
    hw = max.(40_000, 0.15 .* c)
    xd = collect(0.0:2500.0:2_000_000.0)
    kde(x) = sum(b .* (exp.(-0.5 .* ((x .- c) ./ hw) .^ 2) .+ exp.(-0.5 .* ((x .+ c) ./ hw) .^ 2)) ./ hw) / (W * sqrt(2π))
    fd = kde.(xd)
    write_csv(CH, "home-values", "x" => xd, "density" => fd, "share_below" => share_below.(xd))

    # Figure 2.4, log scale. The same estimate as Figure 2.3, redrawn against a log
    # axis: on a log scale the height becomes density × value. Using one kernel for
    # both figures keeps them directly comparable. The dashed reference is a
    # lognormal through the 25th and 75th percentiles (DistributionsFactories).
    lgrid = range(log(10_000), log(4_000_000); length = 600)
    xl = exp.(lgrid)
    fL = kde.(xl) .* xl
    ref = make_dist(LogNormal; quantiles = [(0.25, wquantile(vals, wts, 0.25)), (0.75, wquantile(vals, wts, 0.75))])
    write_csv(CH, "home-values-log", "x" => round.(xl; digits = 0), "log_density" => fL,
        "lognormal_log" => pdf.(ref, xl) .* xl, "share_below" => share_below.(xl))

    # The web edition draws Figure 2.4 with ScaleMorph, whose slider bends the axis
    # from dollars to a log scale. It takes the same estimate as an ordinary density
    # (per dollar), on both grids together, so each end of the slider matches its
    # static figure exactly.
    xm = sort(unique(round.(vcat(xd, xl))))
    write_csv(CH, "home-values-morph", "x" => xm, "density" => kde.(xm),
        "lognormal" => pdf.(ref, xm), "share_below" => share_below.(xm))

    mode_x = xd[argmax(fd)]
    stats = ["mean" => μ, "median" => med, "mode" => mode_x,
        "share_below_mean" => sum(wts[vals .< μ]) / W,
        "p10" => wquantile(vals, wts, 0.10), "p25" => wquantile(vals, wts, 0.25),
        "p75" => wquantile(vals, wts, 0.75), "p90" => wquantile(vals, wts, 0.90),
        "records" => length(vals), "homes" => W,
        "share_at_topcode" => sum(wts[vals .>= 9_999_999]) / W]
    write_csv(CH, "home-values-stats", "stat" => first.(stats), "value" => last.(stats))
    @printf("%d records, %s homes; mean %s, median %s, mode ≈ %s; %.1f%% below the mean\n",
        length(vals), fmt(round(Int, W)), fmt(round(Int, μ)), fmt(round(Int, med)),
        fmt(round(Int, mode_x)), 100 * stats[4][2])
end

# ——— Random raises, compounded (simulated) ———
#
# The twin of Figure 1.3: there, adding many small pieces gave a bell; here,
# multiplying many random raises gives a lean. Every worker starts at the same
# salary, and each year gets a raise drawn from a normal distribution (in
# percent, not in logs, so the lognormal shape isn't built in). The bars are
# shares of workers per bin; the curve is a normal with the same mean and
# standard deviation, scaled to the bins.
function fig_raises(; start = 50_000, workers = 10_000, raise_mean = 0.025, raise_sd = 0.09,
        years = [1, 5, 20, 40], bin = 10_000, xmax = 400_000)
    rng = chapter_rng(CH; stream = 1)
    salary = fill(float(start), workers)
    edges = 0:bin:xmax
    by, bx, bs = Int[], Float64[], Float64[]
    cy, cx, cs = Int[], Float64[], Float64[]
    names, vals = String[], Float64[]
    for y in 1:maximum(years)
        salary .*= 1 .+ raise_mean .+ raise_sd .* randn(rng, workers)
        y in years || continue
        counts = zeros(length(edges) - 1)
        for v in salary
            i = floor(Int, v / bin) + 1
            1 <= i <= length(counts) && (counts[i] += 1)
        end
        append!(by, fill(y, length(counts))); append!(bx, edges[1:end-1] .+ bin / 2); append!(bs, counts ./ workers)
        μ, σ = mean(salary), std(salary)
        d = Normal(μ, σ)
        for x in range(0, xmax; length = 801)
            push!(cy, y); push!(cx, x); push!(cs, pdf(d, x) * bin)
        end
        append!(names, ["mean_$y", "median_$y", "sd_$y", "share_below_mean_$y", "beyond_axis_$y", "normal_below_zero_$y"])
        append!(vals, [μ, median(salary), σ, count(<(μ), salary) / workers, count(>(xmax), salary) / workers, cdf(d, 0)])
        @printf("after %2d years: mean %s, median %s, %.0f%% below the mean\n", y,
            fmt(round(Int, μ)), fmt(round(Int, median(salary))), 100 * count(<(μ), salary) / workers)
    end
    write_csv(CH, "raises", "year" => by, "salary" => bx, "share" => bs)
    write_csv(CH, "raises-normal", "year" => cy, "salary" => cx, "share" => cs)
    write_csv(CH, "raises-stats", "stat" => names, "value" => vals)
end

"""
Two states' home values on a log scale, with their percentiles and a display
table (`<prefix>.csv`, `<prefix>-stats.csv`, `<prefix>-table.csv`). The table's
ratio row is the second state ÷ the first, to `digits` decimals. Uses the cached
national file, which keeps each record's state.
"""
function state_pair_files(states, prefix; digits = 1)
    t = CSV.File(joinpath(RAW, "acs$(ACS_YEAR)_home_values.csv"); types = Dict(:state => String))
    lgrid = range(log(10_000), log(4_000_000); length = 600)
    xl = exp.(lgrid)
    cols = Pair{String,Any}["x" => round.(xl; digits = 0)]
    stats = Pair{String,Float64}[]
    for (fips, name) in states
        k = t.state .== fips
        vals, wts = Float64.(t.value[k]), Float64.(t.weight[k])
        W = sum(wts)
        # The Census top-codes each state's highest values: all of them carry one
        # stand-in value, the state's maximum, which would draw a false bump. They
        # stay out of the curve (so it covers ~99% of homes, scaled to the state's
        # total) but stay in the percentiles and the mean.
        top = maximum(vals)
        keep = vals .< top
        # The same density as Figure 2.4: kernel width max($40,000, 15% of the
        # value), on $1,000 bins, reflected at $0; times x for the log axis.
        bins = zeros(10_000)
        for (v, wt) in zip(vals[keep], wts[keep])
            bins[min(length(bins), floor(Int, v / 1000) + 1)] += wt
        end
        nz = bins .> 0
        c = ((0:length(bins)-1) .* 1000 .+ 500.0)[nz]; b = bins[nz]
        hw = max.(40_000, 0.15 .* c)
        kde(x) = sum(b .* (exp.(-0.5 .* ((x .- c) ./ hw) .^ 2) .+ exp.(-0.5 .* ((x .+ c) ./ hw) .^ 2)) ./ hw) / (W * sqrt(2π))
        push!(cols, name => kde.(xl) .* xl)
        # Exact share of the state's homes at or below each x, from the records
        # (top-coded homes included), for the chart's hover readout.
        o = sortperm(vals); sv = vals[o]; cw = cumsum(wts[o]) ./ W
        push!(cols, "$(name)_below" => [(i = searchsortedlast(sv, x); i == 0 ? 0.0 : cw[i]) for x in xl])
        for (label, p) in (("p10", 0.10), ("p25", 0.25), ("median", 0.50), ("p75", 0.75), ("p90", 0.90))
            push!(stats, "$(name)_$(label)" => wquantile(vals, wts, p))
        end
        push!(stats, "$(name)_mean" => sum(vals .* wts) / W,
            "$(name)_topcoded_share" => sum(wts[.!keep]) / W, "$(name)_records" => length(vals))
        @printf("%-14s median %s, p25–p75 %s–%s, mean %s\n", name, fmt(round(Int, stats[end-5][2])),
            fmt(round(Int, stats[end-6][2])), fmt(round(Int, stats[end-4][2])), fmt(round(Int, stats[end-2][2])))
    end
    write_csv(CH, prefix, cols...)
    write_csv(CH, "$(prefix)-stats", "stat" => first.(stats), "value" => last.(stats))

    # Table 2.1: the same numbers, formatted for display, with a row of ratios.
    d = Dict(stats)
    money(x) = x >= 1e6 ? "\$" * string(round(x / 1e6; digits = 1)) * "M" : "\$" * string(round(Int, x / 1000)) * "K"
    (_, an), (_, bn) = states
    keys6 = ("p10", "p25", "median", "p75", "p90", "mean")
    heads = ("10th", "25th", "Median", "75th", "90th", "Mean")
    ra = [money(d["$(an)_$k"]) for k in keys6]
    rb = [money(d["$(bn)_$k"]) for k in keys6]
    ratio = Printf.Format("%.$(digits)f×")   # "2.0×" stays text in the CSV
    rr = [Printf.format(ratio, d["$(bn)_$k"] / d["$(an)_$k"]) for k in keys6]
    write_csv(CH, "$(prefix)-table", "State" => [titlecase(an), titlecase(bn), "Ratio"],
        (h => [ra[i], rb[i], rr[i]] for (i, h) in enumerate(heads))...)
end

# ——— Same mean, different spread (simulated) ———
#
# Two normal curves with the same mean and very different standard deviations,
# with a strip of random draws from each: the narrow one gives steady values,
# the wide one values that bounce around.
function fig_spread(; μ = 50, sds = (5, 20), draws = 40)
    rng = chapter_rng(CH; stream = 2)
    xs = round.(range(0, 100; length = 401); digits = 2)
    density_csv(CH, "spread", xs, "narrow" => Normal(μ, sds[1]), "wide" => Normal(μ, sds[2]))
    v = vcat(μ .+ sds[1] .* randn(rng, draws), μ .+ sds[2] .* randn(rng, draws))
    write_csv(CH, "spread-draws", "series" => vcat(fill("narrow", draws), fill("wide", draws)),
        "value" => round.(v; digits = 2))
end

# Same shape, shifted: Massachusetts is about twice Wisconsin all the way along.
fig_state_pair() = state_pair_files(("55" => "wisconsin", "25" => "massachusetts"), "state-pair")

# Same median, different widths: Tennessee spreads further both ways than Minnesota.
function fig_state_contrast()
    state_pair_files(("27" => "minnesota", "47" => "tennessee"), "state-contrast"; digits = 2)
    # The ordinary (dollar) mean ± one standard deviation, which runs below $0 for
    # Tennessee. All records, top-coded ones included.
    t = CSV.File(joinpath(RAW, "acs$(ACS_YEAR)_home_values.csv"); types = Dict(:state => String))
    money(x) = (x < 0 ? "−" : "") * (abs(x) >= 1e6 ? "\$" * string(round(abs(x) / 1e6; digits = 1)) * "M" :
                                                    "\$" * string(round(Int, abs(x) / 1000)) * "K")
    rows = [begin
        k = t.state .== fips
        v, w = Float64.(t.value[k]), Float64.(t.weight[k])
        m = sum(v .* w) / sum(w); sd = sqrt(sum(w .* (v .- m) .^ 2) / sum(w))
        (name, money(m), money(sd), money(m - sd), money(m + sd))
    end for (fips, name) in (("27", "Minnesota"), ("47", "Tennessee"))]
    write_csv(CH, "state-contrast-sd-table", "State" => first.(rows), "Mean" => getindex.(rows, 2),
        "Standard deviation" => getindex.(rows, 3), "Mean − 1 SD" => getindex.(rows, 4), "Mean + 1 SD" => getindex.(rows, 5))

    # The geometric versions: mean and standard deviation of the logs, converted
    # back. The range is geometric mean ÷ and × the geometric SD. All records.
    geo = [begin
        k = t.state .== fips
        v, w = Float64.(t.value[k]), Float64.(t.weight[k])
        μ = sum(w .* log.(v)) / sum(w); σ = sqrt(sum(w .* (log.(v) .- μ) .^ 2) / sum(w))
        gm, gsd = exp(μ), exp(σ)
        inside = sum(w[gm / gsd .<= v .<= gm * gsd]) / sum(w)
        @printf("%-10s geometric mean %s, geometric SD %.2f, %.0f%% of homes within\n", name, fmt(round(Int, gm)), gsd, 100inside)
        (name, money(gm), Printf.format(Printf.Format("%.1f×"), gsd), money(gm / gsd), money(gm * gsd))
    end for (fips, name) in (("27", "Minnesota"), ("47", "Tennessee"))]
    write_csv(CH, "state-contrast-geo-table", "State" => first.(geo), "Geometric mean" => getindex.(geo, 2),
        "Geometric SD" => getindex.(geo, 3), "Mean ÷ SD" => getindex.(geo, 4), "Mean × SD" => getindex.(geo, 5))
end

# Run everything, or name figures:  julia --project ch02.jl home_values
const FIGURES = Dict("salaries" => fig_salaries, "home_values" => fig_home_values,
    "state_pair" => fig_state_pair, "state_contrast" => fig_state_contrast, "raises" => fig_raises,
    "spread" => fig_spread)
for name in (isempty(ARGS) ? collect(keys(FIGURES)) : ARGS)
    FIGURES[name]()
end
