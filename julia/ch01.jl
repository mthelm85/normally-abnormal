# Chapter 1 -- The Average Millionaire
#
#     cd julia
#     julia --project ch01.jl
#
# One function per figure; each writes one CSV with write_csv(CH, "name", ...).

include("common.jl")

using CSV
using Downloads
using ZipFile

const CH = 1

# ——— Figure 1.1: U.S. family net worth (2022 Survey of Consumer Finances) ———
#
# Source: Federal Reserve Board, 2022 SCF, Summary Extract Public Data.
# https://www.federalreserve.gov/econres/scfindex.htm
#
# The public file has five rows per family (one per imputation "implicate").
# Statistics are computed within each implicate and averaged, as the Fed does.
# Public-file estimates differ slightly from the Fed's published Bulletin
# figures, which use internal data (mean $1,059,470 public vs $1,063,700 Bulletin).

const SCF_URL = "https://www.federalreserve.gov/econres/files/scfp2022excel.zip"
const RAW = joinpath(@__DIR__, "raw")   # downloaded once; ignored by git

"Download the 2022 SCF summary extract (once) and return net worth, weights and implicate."
function load_scf()
    mkpath(RAW)
    zipfile = joinpath(RAW, basename(SCF_URL))
    isfile(zipfile) || (println("downloading ", SCF_URL); Downloads.download(SCF_URL, zipfile))
    reader = ZipFile.Reader(zipfile)
    try
        file = only(filter(f -> endswith(lowercase(f.name), ".csv"), reader.files))
        t = CSV.File(read(file); select = ["YY1", "Y1", "WGT", "NETWORTH"])
        networth = Float64.(t.NETWORTH)
        weight = Float64.(t.WGT)
        implicate = Int.(t.Y1 .- 10 .* t.YY1)          # Y1 = 10 * family id + implicate (1-5)
        return (; networth, weight, implicate)
    finally
        close(reader)
    end
end

"Weighted quantile `p` of `x` with weights `w`."
function wquantile(x, w, p)
    order = sortperm(x)
    cw = cumsum(w[order])
    return x[order][searchsortedfirst(cw, p * cw[end])]
end

"Weighted share of `x` strictly below each value in `at`."
function wshare_below(x, w, at)
    order = sortperm(x)
    xs, cw = x[order], cumsum(w[order]) ./ sum(w)
    return [(i = searchsortedfirst(xs, v) - 1; i == 0 ? 0.0 : cw[i]) for v in at]
end

"""
Weighted Gaussian KDE of `x`, smoothed on the asinh scale u = asinh(x / s) and
converted back to a density in dollars on the grid `xs`. The transform keeps
detail near zero (where most families are) while taming a tail that runs into
the billions; on the dollar scale it means a narrower kernel near zero and a
wider one far out in the tail.
"""
function asinh_kde(x, w, xs; s = 25_000.0, n_eff = length(x))
    u = asinh.(x ./ s)
    w = w ./ sum(w)
    mu = sum(w .* u)
    sd = sqrt(sum(w .* (u .- mu) .^ 2))
    iqr = wquantile(u, w, 0.75) - wquantile(u, w, 0.25)
    h = 0.9 * min(sd, iqr / 1.34) * n_eff^(-1 / 5)       # Silverman's rule
    ug = asinh.(xs ./ s)
    fu = [sum(w .* exp.(-0.5 .* ((g .- u) ./ h) .^ 2)) / (h * sqrt(2pi)) for g in ug]
    return fu ./ sqrt.(xs .^ 2 .+ s^2)                     # Jacobian: du/dx = 1/sqrt(x^2 + s^2)
end

function fig_net_worth()
    d = load_scf()
    imps = 1:5
    pick(i) = d.implicate .== i

    # The Fed's convention: estimate within each implicate, then average.
    mean_nw = sum(sum(d.networth[pick(i)] .* d.weight[pick(i)]) / sum(d.weight[pick(i)]) for i in imps) / 5
    median_nw = sum(wquantile(d.networth[pick(i)], d.weight[pick(i)], 0.5) for i in imps) / 5
    below_mean = sum(only(wshare_below(d.networth[pick(i)], d.weight[pick(i)], [mean_nw])) for i in imps) / 5
    negative = sum(sum(d.weight[pick(i)] .* (d.networth[pick(i)] .< 0)) / sum(d.weight[pick(i)]) for i in imps) / 5
    largest = maximum(d.networth)

    # Plot from -$250k to $2.5M; the tail beyond is real but would flatten the picture.
    lo, hi = -250_000.0, 2_500_000.0
    xs = collect(range(lo, hi; length = 700))
    families = length(d.networth) ÷ 5
    density = asinh_kde(d.networth, d.weight, xs; n_eff = families)
    share = wshare_below(d.networth, d.weight, xs)
    above_hi = 1 - sum(only(wshare_below(d.networth[pick(i)], d.weight[pick(i)], [hi])) for i in imps) / 5

    write_csv(CH, "net-worth", "x" => xs, "density" => density, "share_below" => share)
    write_csv(CH, "net-worth-stats",
        "stat" => ["mean", "median", "share_below_mean", "share_negative", "share_above_plot",
                   "largest", "families"],
        "value" => [round(mean_nw), round(median_nw), round(below_mean; digits = 3),
                    round(negative; digits = 3), round(above_hi; digits = 3), largest, families])

    println("mean net worth:         \$", fmt(round(Int, mean_nw)))
    println("median net worth:       \$", fmt(round(Int, median_nw)))
    println("families below the mean: ", fmt(100 * below_mean), "%")
    println("families below zero:     ", fmt(100 * negative), "%")
    println("families above \$2.5M:   ", fmt(100 * above_hi), "% (off the right edge of the plot)")
    println("largest net worth:      \$", fmt(round(Int, largest)), " (public file; the SCF excludes the Forbes 400)")
end

# ——— Figure 1.2: penalty kicks as Bernoulli trials ———
#
# Simulated: a player who scores with probability p, kick after kick. The
# running share of goals swings early and settles toward p as kicks pile up.

function fig_penalty_kicks(; p = 0.75, n = 1_000)
    rng = chapter_rng(CH; stream = 2)
    outcome = Int.(rand(rng, n) .< p)
    running = cumsum(outcome) ./ (1:n)

    write_csv(CH, "penalty-kicks", "trial" => 1:n, "outcome" => outcome, "running" => running)
    checkpoints = [10, 40, 100, 1_000]
    write_csv(CH, "penalty-kicks-stats",
        "stat" => ["p", "n", "goals_first_40", ["share_after_$k" for k in checkpoints]...],
        "value" => [p, n, sum(outcome[1:40]), [round(running[k]; digits = 3) for k in checkpoints]...])

    println("penalty kicks (p = ", p, "): first 40 = ", join(outcome[1:40]))
    for k in checkpoints
        println("  share after ", lpad(fmt(k), 5), " kicks: ", fmt(100 * running[k]), "%")
    end
end

# ——— Figure 1.3: buckets of kicks ———
#
# Split the kicking into buckets of n kicks and record the share of goals in
# each. Small buckets give wildly different shares; big buckets bunch tightly
# around p, and the histogram of shares takes on the bell shape of the Normal
# curve (the central limit theorem). Bucket sizes are chosen so a share of
# exactly p is possible (12 kicks: 9 of 12 = 75%). The curve, drawn over the
# larger buckets only, is
# Normal(p, sqrt(p(1-p)/n)), scaled to bar heights (bars are 1/n apart).

function fig_buckets(; p = 0.75, sizes = [1, 12, 40, 100], curve_from = 40, buckets = 10_000)
    rng = chapter_rng(CH; stream = 3)
    size_col, share_col, freq_col = Int[], Float64[], Float64[]
    stat_names, stat_values = String[], Float64[]
    for n in sizes
        goals = [count(<(p), rand(rng, n)) for _ in 1:buckets]
        for k in 0:n
            push!(size_col, n); push!(share_col, k / n); push!(freq_col, count(==(k), goals) / buckets)
        end
        shares = goals ./ n
        within = count(s -> abs(s - p) <= 0.05 + 1e-9, shares) / buckets   # tolerance: 0.70 and 0.80 count
        hit = p * n                                 # goals for a share of exactly p
        at_p = isinteger(hit) ? count(==(Int(hit)), goals) / buckets : NaN
        push!(stat_names, "sd_$n", "within_5pts_$n", "at_p_$n")
        push!(stat_values, round(std(shares); digits = 4), round(within; digits = 3), round(at_p; digits = 3))
        println("buckets of ", lpad(n, 3), " kicks: sd of shares = ", fmt(100 * std(shares)),
                " pts; within 5 pts of p: ", fmt(100 * within), "%",
                isnan(at_p) ? "" : "; exactly at p: " * fmt(100 * at_p) * "%")
    end
    write_csv(CH, "buckets", "size" => size_col, "share" => share_col, "freq" => freq_col)
    write_csv(CH, "buckets-stats", "stat" => stat_names, "value" => stat_values)

    curve_size, curve_x, curve_y = Int[], Float64[], Float64[]
    for n in sizes
        n < curve_from && continue
        d = Normal(p, sqrt(p * (1 - p) / n))
        for x in range(0, 1; length = 401)
            push!(curve_size, n); push!(curve_x, x); push!(curve_y, pdf(d, x) / n)
        end
    end
    write_csv(CH, "buckets-normal", "size" => curve_size, "share" => curve_x, "freq" => curve_y)
end

# ——— Figure 1.4: the bell the buckets approach ———
#
# The normal curve for buckets of n = 100 kicks: mean p and standard deviation
# sqrt(p(1 - p)/n), about 4.3 percentage points. Its mean, median and mode are
# all p. No randomness here, so no rng stream.
function fig_bell(; p = 0.75, n = 100)
    d = Normal(p, sqrt(p * (1 - p) / n))
    xs = round.(range(0.55, 0.95; length = 401); digits = 4)
    density_csv(CH, "bell", xs, "density" => d)
    sd = std(d)
    within(k) = cdf(d, p + k * sd) - cdf(d, p - k * sd)
    write_csv(CH, "bell-stats",
        "stat" => ["mean", "median", "mode", "sd", "within_1sd", "within_2sd"],
        "value" => [mean(d), median(d), mode(d), sd, within(1), within(2)])
end

fig_net_worth()
fig_penalty_kicks()
fig_buckets()
fig_bell()
