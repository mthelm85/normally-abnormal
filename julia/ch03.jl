# Chapter 3 -- Ruled by the Few
#
#     cd julia
#     julia --project ch03.jl
#
# One function per figure; each writes its CSVs with write_csv(CH, "name", ...)
# or density_csv(CH, "name", xs, ...). Simulations draw from chapter_rng(CH; stream = k),
# one stream per figure, so results are identical on every run.

include("common.jl")

using CSV
using DBInterface
using DistributionsFactories
using Downloads
using JSON
using SQLite
using ZipFile

const CH = 3
const RAW = joinpath(@__DIR__, "raw")   # downloaded by hand; ignored by git

# ——— Shared helpers ———

"Weighted quantile `p` of `x` with weights `w` (as in ch01.jl)."
function wquantile(x, w, p)
    order = sortperm(x)
    cw = cumsum(w[order])
    return x[order][searchsortedfirst(cw, p * cw[end])]
end

"Share of the total held by the largest fraction `p` of cases, weighted."
function top_share(x, w, p)
    o = sortperm(x; rev = true)
    cw = cumsum(w[o]) ./ sum(w)
    cx = cumsum(x[o] .* w[o]) ./ sum(x .* w)
    return cx[min(length(cx), searchsortedfirst(cw, p))]
end

"""
Pareto tail exponent α for the values at or above `xmin`: the maximum-likelihood
(Hill) estimate, α = Σw / Σ w·log(x/xmin). Weighted for the SCF. For unweighted
data it is checked against Distributions' own `fit_mle(Pareto, …)`.
"""
function tail_alpha(x, w, xmin)
    k = x .>= xmin
    α = sum(w[k]) / sum(w[k] .* log.(x[k] ./ xmin))
    if all(==(1), w)
        tail = x[k]
        check = shape(fit_mle(Pareto, tail))   # fit_mle sets θ = minimum(tail)
        own = length(tail) / sum(log.(tail ./ minimum(tail)))
        isapprox(check, own; rtol = 1e-8) || error("Pareto fit_mle disagrees with the Hill formula")
    end
    return α
end

"Ranks spaced evenly on a log scale (about `n` of them, 1 to N), for thinned rank–size plots."
log_ranks(N; n = 400) = unique(round.(Int, exp.(range(0, log(N); length = n))))

"Write a stats file (`<name>-stats.csv`) from a vector of `stat => value` pairs."
write_stats(name, stats) = write_csv(CH, "$(name)-stats", "stat" => first.(stats), "value" => last.(stats))

"Read back a stats file written by `write_stats`."
function read_stats(name)
    t = CSV.File(joinpath(chapter_data_dir(CH), "$(name)-stats.csv"); types = String)
    return Dict(zip(t.stat, t.value))
end

money(x) = x >= 1e6 ? "\$" * string(round(x / 1e6; digits = 2)) * "M" : "\$" * string(round(Int, x / 1000)) * "K"
pct(x) = string(round(Int, 100x)) * "%"

# ——— Figures 3.1, 3.2, 3.5, 3.6: U.S. wildfires, 1992–2024 ———
#
# Source: Short, K. C. 2026. Spatial wildfire occurrence data for the United
# States, 1992–2024 [FPA_FOD_20260615]. 7th ed. Fort Collins, CO: Forest Service
# Research Data Archive. https://doi.org/10.2737/RDS-2013-0009.7
# Download RDS-2013-0009.7_Data_Format4_SQLITE.zip by hand into raw/; the SQLite
# file (~1 GB) is unzipped from it on the first run.
#
# FIRE_SIZE is the final burned area in acres. Sizes are heaped at round values
# (0.1, 0.25, 1 acre, …), so tail fits start well above the heaping (100 acres).

const FPA_ZIP = joinpath(RAW, "RDS-2013-0009.7_Data_Format4_SQLITE.zip")
const FIRE_XMIN = 100.0          # acres; start of the Pareto fit

function load_fires()
    db_path = joinpath(RAW, "FPA_FOD_20260615.sqlite")
    if !isfile(db_path)
        isfile(FPA_ZIP) || error("Download $(basename(FPA_ZIP)) from the USFS archive into raw/ first")
        reader = ZipFile.Reader(FPA_ZIP)
        try
            f = only(filter(f -> endswith(f.name, ".sqlite"), reader.files))
            println("unzipping ", f.name, " (about 1 GB, once)")
            open(db_path, "w") do io
                write(io, read(f))
            end
        finally
            close(reader)
        end
    end
    db = SQLite.DB(db_path)
    acres, when, name, state, year = Float64[], Float64[], String[], String[], Int[]
    sql = "SELECT FIRE_YEAR, DISCOVERY_DOY, FIRE_SIZE, FIRE_NAME, STATE FROM Fires ORDER BY DISCOVERY_DATE"
    for r in DBInterface.execute(db, sql)
        push!(acres, r.FIRE_SIZE)
        push!(when, r.FIRE_YEAR + (r.DISCOVERY_DOY - 0.5) / 366)   # decimal year, discovery order
        push!(name, coalesce(r.FIRE_NAME, ""))
        push!(state, r.STATE)
        push!(year, r.FIRE_YEAR)
    end
    close(db)
    return (; acres, when, name, state, year)
end

function fig_fires()
    d = load_fires()
    x = d.acres
    N = length(x)
    w = ones(N)
    μ, med = mean(x), median(x)
    s = sort(x; rev = true)
    cx = cumsum(s) ./ sum(s)

    # Figure 3.1: who burns the land. Share of all acres (y) burned by the largest
    # share of fires (x), thinned to log-spaced ranks.
    r = log_ranks(N; n = 500)
    write_csv(CH, "fires-concentration", "share_fires" => 100 .* r ./ N, "share_acres" => 100 .* cx[r])

    # Figure 3.2: the log-scale morph (ScaleMorph, as Figure 2.4). Density from a
    # Gaussian kernel on log(acres), converted to a per-acre density so the chart's
    # x^(1 − λ) factor works as in Chapter 2. Binned to 0.01 log units first.
    # Kernel width: 1.0 in natural-log units (a factor of e either way). Records are
    # heaped at round sizes -- about 61% of fires sit at eight values, a quarter at
    # exactly 0.1 acre -- and narrower kernels turn the heaps into false peaks (three
    # modes at 0.5, two at 0.75). 1.0 is the narrowest of those tried with one peak;
    # the long right side, which is the figure's point, is unaffected.
    lx = log.(x)
    lo, dl = floor(minimum(lx); digits = 2), 0.01
    bins = zeros(ceil(Int, (maximum(lx) - lo) / dl) + 1)
    for v in lx
        bins[floor(Int, (v - lo) / dl) + 1] += 1
    end
    keep = bins .> 0
    c = (lo .+ dl .* ((0:length(bins)-1) .+ 0.5))[keep]; b = bins[keep]
    h = 1.0
    g(u) = sum(b .* exp.(-0.5 .* ((u .- c) ./ h) .^ 2)) / (N * h * sqrt(2π))   # density of log(acres)
    sx = sort(x)
    share_below(v) = searchsortedlast(sx, v) / N
    xm = sort(unique(vcat(collect(0.5:0.5:1000.0), round.(exp.(range(log(0.01), log(2e6); length = 600)); sigdigits = 4))))
    write_csv(CH, "fires-morph", "x" => xm, "density" => g.(log.(xm)) ./ xm, "share_below" => share_below.(xm))

    # Figure 3.6: rank against size on log–log axes, with the Pareto line fitted
    # above FIRE_XMIN. The line is drawn over the sizes it was fitted to.
    α = tail_alpha(x, w, FIRE_XMIN)
    k = count(>=(FIRE_XMIN), x)
    pareto = [v >= FIRE_XMIN ? k * (v / FIRE_XMIN)^(-α) : missing for v in s[r]]
    write_csv(CH, "fires-rank", "rank" => r, "acres" => s[r], "pareto" => pareto)

    # Figure 3.5: running mean and median, fires in order of discovery, checked at
    # the end of every month.
    checkpoints = 1992 .+ (1:33*12) ./ 12
    idx = [searchsortedlast(d.when, t) for t in checkpoints]
    run_mean = cumsum(x) ./ (1:N)
    write_csv(CH, "fires-running", "year" => round.(checkpoints; digits = 3), "fires" => idx,
        "mean" => run_mean[idx], "median" => [median(view(x, 1:i)) for i in idx])

    big = argmax(x)
    stats = ["fires" => N, "acres" => sum(x), "mean" => μ, "median" => med,
        "share_below_mean" => count(<(μ), x) / N,
        "top_0_1" => cx[round(Int, 0.001N)], "top_1" => cx[round(Int, 0.01N)], "top_10" => cx[round(Int, 0.10N)],
        "largest" => x[big], "largest_name" => titlecase(d.name[big]), "largest_state" => d.state[big],
        "largest_year" => d.year[big], "largest_share" => x[big] / sum(x),
        "largest_sds" => (x[big] - μ) / std(x),
        "alpha" => α, "alpha_xmin" => FIRE_XMIN, "alpha_fires" => k,
        "years" => "1992–2024"]
    write_stats("fires", stats)
    @printf("%d fires, %s acres; mean %.1f, median %.2f acres; top 1%% burn %.1f%%; α = %.2f above %d acres\n",
        N, fmt(round(Int, sum(x))), μ, med, 100 * cx[round(Int, 0.01N)], α, Int(FIRE_XMIN))
    @printf("largest: %s (%s, %d), %s acres, %.0f SDs above the mean\n", titlecase(d.name[big]),
        d.state[big], d.year[big], fmt(round(Int, x[big])), (x[big] - μ) / std(x))
end

# ——— Figure 3.3: U.S. cities and towns, 2025 ———
#
# Source: U.S. Census Bureau, Vintage 2025 population estimates for incorporated
# places and minor civil divisions, sub-est2025.csv, downloaded by hand into raw/:
# https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv
# Incorporated places only (SUMLEV 162): cities, towns, villages and boroughs.

const CITY_XMIN = 50_000.0       # people; start of the Pareto fit

function fig_cities()
    t = CSV.File(joinpath(RAW, "sub-est2025.csv"); select = [:SUMLEV, :NAME, :STNAME, :POPESTIMATE2025],
        types = Dict(:SUMLEV => String))
    keep = (t.SUMLEV .== "162") .& (t.POPESTIMATE2025 .> 0)
    x = Float64.(t.POPESTIMATE2025[keep])
    N = length(x)
    w = ones(N)
    s = sort(x; rev = true)
    μ, med = mean(x), median(x)

    # Rank–size points, a lognormal fitted to every place (its expected rank at
    # each size is N × the share of places at least that big), and the Pareto
    # line fitted above CITY_XMIN.
    ln = fit_mle(LogNormal, x)
    α = tail_alpha(x, w, CITY_XMIN)
    k = count(>=(CITY_XMIN), x)
    r = log_ranks(N; n = 500)
    pareto = [v >= CITY_XMIN ? k * (v / CITY_XMIN)^(-α) : missing for v in s[r]]
    write_csv(CH, "cities-rank", "rank" => r, "population" => s[r],
        "lognormal" => N .* ccdf.(ln, s[r]), "pareto" => pareto)

    stats = ["places" => N, "mean" => μ, "median" => med, "share_below_mean" => count(<(μ), x) / N,
        "top_1" => top_share(x, w, 0.01), "top_10" => top_share(x, w, 0.10),
        "alpha" => α, "alpha_xmin" => CITY_XMIN, "alpha_places" => k,
        "lognormal_mean" => mean(ln),
        "over_100k" => count(>=(1e5), x), "over_100k_lognormal" => N * ccdf(ln, 1e5),
        "over_1m" => count(>=(1e6), x), "over_1m_lognormal" => N * ccdf(ln, 1e6)]
    write_stats("cities", stats)
    @printf("%d places; mean %s, median %s; α = %.2f above %s; over 1M: %d (lognormal %.1f)\n",
        N, fmt(round(Int, μ)), fmt(round(Int, med)), α, fmt(round(Int, CITY_XMIN)),
        count(>=(1e6), x), N * ccdf(ln, 1e6))
end

# ——— Household wealth (2022 Survey of Consumer Finances), for Table 3.1 ———
#
# The same file as Chapter 1 (raw/scfp2022excel.zip; see ch01.jl). Statistics are
# computed within each of the five implicates and averaged, as the Fed does.
# The SCF excludes the Forbes 400 by design.

const SCF_ZIP = joinpath(RAW, "scfp2022excel.zip")
const WEALTH_XMIN = 5e6          # dollars; start of the Pareto fit

function load_scf()
    isfile(SCF_ZIP) || error("Run ch01.jl first; it downloads the SCF to raw/")
    reader = ZipFile.Reader(SCF_ZIP)
    try
        file = only(filter(f -> endswith(lowercase(f.name), ".csv"), reader.files))
        t = CSV.File(read(file); select = ["YY1", "Y1", "WGT", "NETWORTH"])
        return (networth = Float64.(t.NETWORTH), weight = Float64.(t.WGT), implicate = Int.(t.Y1 .- 10 .* t.YY1))
    finally
        close(reader)
    end
end

function fig_wealth()
    d = load_scf()
    per = map(1:5) do m
        k = d.implicate .== m
        x, w = d.networth[k], d.weight[k]
        (mean = sum(x .* w) / sum(w), median = wquantile(x, w, 0.5),
            share_below_mean = sum(w[x .< sum(x .* w) / sum(w)]) / sum(w),
            top_1 = top_share(x, w, 0.01), top_10 = top_share(x, w, 0.10),
            alpha = tail_alpha(x, w, WEALTH_XMIN))
    end
    avg(f) = mean(getfield.(per, f))
    stats = ["mean" => avg(:mean), "median" => avg(:median), "share_below_mean" => avg(:share_below_mean),
        "top_1" => avg(:top_1), "top_10" => avg(:top_10), "alpha" => avg(:alpha), "alpha_xmin" => WEALTH_XMIN]
    write_stats("wealth", stats)
    @printf("wealth: mean %s, median %s; top 1%% hold %.1f%%, top 10%% %.1f%%; α = %.2f above %s\n",
        money(avg(:mean)), money(avg(:median)), 100avg(:top_1), 100avg(:top_10), avg(:alpha), money(WEALTH_XMIN))
end

# ——— Figure 3.4: Chapter 2's raises, with newcomers ———
#
# Figure 2.2 followed one class of 10,000 workers who all started at $50,000 and
# got random raises (mean 2.5%, SD 9 percentage points) every year. Here the same
# raises run in two populations of 10,000:
#   together:  everyone starts at once and is seen after 40 years (Figure 2.2's
#              last panel), so sizes are lognormal;
#   newcomers: a population that grows by `growth` a year through newcomers
#              starting at $50,000, so members have every age: the share at
#              least `a` years old is (1 + growth)^-a.
# Mixing ages turns the lognormal into a power-law tail (Reed 2001). Its exponent
# α solves E[(1 + raise)^α] = 1 + growth; with 3% growth, α ≈ 1.17, close to
# the 80/20 rule's 1.16. The script computes that α and checks it against a fit
# to the simulated top tail.

function fig_newcomers(; start = 50_000, units = 10_000, raise_mean = 0.025, raise_sd = 0.09,
        years_together = 40, growth = 0.03, tail_units = 1_000)
    rng = chapter_rng(CH; stream = 1)
    grow(age) = start * prod(1 + raise_mean + raise_sd * randn(rng) for _ in 1:age; init = 1.0)

    together = [grow(years_together) for _ in 1:units]
    ages = [floor(Int, -log(rand(rng)) / log(1 + growth)) for _ in 1:units]
    newcomers = grow.(ages)

    # The exponent theory predicts: E[(1 + r)^α] = 1 + growth for r ~ Normal(raise_mean,
    # raise_sd), by numerical integration over the normal, then bisection on α.
    z = -8:0.001:8
    wz = pdf.(Normal(), z) .* step(z)
    moment(α) = sum(wz .* max.(1 .+ raise_mean .+ raise_sd .* z, 0) .^ α)
    lo, hi = 0.01, 20.0
    for _ in 1:100
        mid = (lo + hi) / 2
        moment(mid) < 1 + growth ? (lo = mid) : (hi = mid)
    end
    α_theory = (lo + hi) / 2

    t, n = sort(together; rev = true), sort(newcomers; rev = true)
    α_fit = tail_alpha(n, ones(units), n[tail_units])
    r = log_ranks(units; n = 400)
    # A Pareto line with the theoretical α, through the newcomers' rank-100 point,
    # drawn over the top `tail_units`.
    anchor = 100
    pareto = [rk <= tail_units ? anchor * (n[rk] / n[anchor])^(-α_theory) : missing for rk in r]
    write_csv(CH, "newcomers-rank", "rank" => r, "together" => t[r], "newcomers" => n[r], "pareto" => pareto)

    stats = ["alpha_theory" => α_theory, "alpha_fit" => α_fit, "growth" => growth,
        "mean_age" => mean(ages), "oldest" => maximum(ages),
        "together_mean" => mean(together), "together_median" => median(together),
        "together_top_1" => top_share(together, ones(units), 0.01),
        "newcomers_mean" => mean(newcomers), "newcomers_median" => median(newcomers),
        "newcomers_top_1" => top_share(newcomers, ones(units), 0.01),
        "newcomers_top_20" => top_share(newcomers, ones(units), 0.20)]
    write_stats("newcomers", stats)
    @printf("together (all %d years): top 1%% hold %.1f%%; newcomers (%.0f%% growth, mean age %.0f): top 1%% hold %.1f%%, top 20%% hold %.1f%%\n",
        years_together, 100 * top_share(together, ones(units), 0.01), 100growth, mean(ages),
        100 * top_share(newcomers, ones(units), 0.01), 100 * top_share(newcomers, ones(units), 0.20))
    @printf("tail exponent: theory %.2f, fitted to the top %d %.2f\n", α_theory, tail_units, α_fit)
end

# ——— Table 3.1: who holds the total, three datasets side by side ———
# Built from the three stats files, so run fires, wealth and cities first.

function fig_shares_table()
    f, w, c = read_stats("fires"), read_stats("wealth"), read_stats("cities")
    num(d, k) = parse(Float64, d[k])
    acres(v) = v < 10 ? string(round(v; digits = 1)) * " acres" : fmt(round(Int, v)) * " acres"
    write_csv(CH, "shares-table",
        "Measure" => ["Wildfire size", "Household net worth", "City or town population"],
        "Median" => [acres(num(f, "median")), money(num(w, "median")), fmt(round(Int, num(c, "median")))],
        "Mean" => [acres(num(f, "mean")), money(num(w, "mean")), fmt(round(Int, num(c, "mean")))],
        "Top 1% hold" => pct.([num(f, "top_1"), num(w, "top_1"), num(c, "top_1")]),
        "Top 10% hold" => pct.([num(f, "top_10"), num(w, "top_10"), num(c, "top_10")]))
end

# ——— Exploration only: CEO total pay (SEC proxy filings) ———
# Dropped from the chapter (close to lognormal); kept so the check can be rerun.
#
# Source: SEC XBRL "frames" API, tag ecd:PeoTotalCompAmt -- the principal
# executive officer's Summary Compensation Table total (salary, bonus, stock and
# option awards at grant-date value, etc.), tagged in pay-versus-performance
# disclosures. One value per company per calendar-year frame.
#   https://data.sec.gov/api/xbrl/frames/ecd/PeoTotalCompAmt/USD/CY2024.json
#
# The SEC asks automated requests to identify themselves. Set once, like the
# Census key (PowerShell):
#   [Environment]::SetEnvironmentVariable("SEC_USER_AGENT", "Matt Helm you@example.com", "User")
# The response is cached in raw/ so the SEC is hit only once per year.

const SEC_YEARS = (2023, 2024)

function sec_peo_pay(year)
    cache = joinpath(RAW, "sec_peo_total_comp_CY$(year).json")
    if !isfile(cache)
        ua = get(ENV, "SEC_USER_AGENT", "")
        isempty(ua) && error("Set SEC_USER_AGENT (name and email) before fetching from the SEC")
        url = "https://data.sec.gov/api/xbrl/frames/ecd/PeoTotalCompAmt/USD/CY$(year).json"
        mkpath(RAW)
        Downloads.download(url, cache; headers = ["User-Agent" => ua, "Accept" => "application/json"])
        sleep(0.5)   # stay well under the SEC's 10 requests/second
    end
    data = JSON.parse(read(cache, String))
    pts = data["data"]
    return (cik = [p["cik"] for p in pts], company = [p["entityName"] for p in pts],
        start = [get(p, "start", "") for p in pts], stop = [p["end"] for p in pts],
        pay = [Float64(p["val"]) for p in pts])
end

# Exploration only: one tidy CSV per year in raw/ (not published), for looking
# at the shape before deciding on Figure 3.1.
function fig_ceo_pay()
    for year in SEC_YEARS
        d = sec_peo_pay(year)
        path = joinpath(RAW, "ceo_pay_CY$(year).csv")
        open(path, "w") do io
            println(io, "cik,company,start,end,pay")
            for i in eachindex(d.pay)
                println(io, join((d.cik[i], csvcell(d.company[i]), d.start[i], d.stop[i], d.pay[i]), ","))
            end
        end
        println("wrote ", relpath(path, ROOT), " (", length(d.pay), " companies)")
    end
end

# Run everything (in this order; the table reads the others' stats), or name
# steps:  julia --project ch03.jl cities
const FIGURES = ["fires" => fig_fires, "wealth" => fig_wealth, "cities" => fig_cities,
    "shares_table" => fig_shares_table, "newcomers" => fig_newcomers]
const EXPLORE = ["ceo_pay" => fig_ceo_pay]   # run only when named
const STEPS = Dict(vcat(FIGURES, EXPLORE))
for name in (isempty(ARGS) ? first.(FIGURES) : ARGS)
    STEPS[name]()
end
