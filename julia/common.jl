# common.jl -- shared helpers for every chapter script.
#
# Each chapter script starts with `include("common.jl")`, builds its figure
# data, and writes one wide-format CSV per figure into that chapter's
# src/chapters/<nn>-<slug>/data/ folder, where the Svelte page imports it.
#
#     cd julia
#     julia --project ch01.jl

using Distributions
using Printf
using Random
using StableRNGs
using Statistics

const ROOT = dirname(@__DIR__)
const CHAPTERS = joinpath(ROOT, "src", "chapters")

"""
    chapter_rng(n; stream = 0)

The random-number generator for chapter `n`. Every simulation draws from one
of these, so figures and the numbers quoted in the prose are identical on
every run and every Julia version. Give each figure its own `stream` (0-999).
"""
chapter_rng(n::Integer; stream::Integer = 0) = StableRNG(1000 * n + stream)

"The data/ folder for chapter `n`, found by its two-digit prefix."
function chapter_data_dir(n::Integer)
    prefix = @sprintf("%02d-", n)
    dirs = filter(d -> startswith(d, prefix), readdir(CHAPTERS))
    length(dirs) == 1 || error("Expected one chapter folder starting with $prefix, found $(length(dirs))")
    dir = joinpath(CHAPTERS, only(dirs), "data")
    mkpath(dir)
    return dir
end

csvcell(x) = string(x)
csvcell(x::AbstractString) = occursin(r"[\",\n]", x) ? "\"" * replace(x, "\"" => "\"\"") * "\"" : x
csvcell(::Missing) = ""

"""
    write_csv(n, name, "col" => values, ...)

Write one figure's data for chapter `n` as `data/<name>.csv`, one column per
series (the wide format the chart kit expects). Returns the file path.

    write_csv(1, "heights", "x" => xs, "density" => ys)
"""
function write_csv(n::Integer, name::AbstractString, columns::Pair...)
    isempty(columns) && error("write_csv needs at least one column")
    len = length(last(first(columns)))
    all(length(last(c)) == len for c in columns) || error("All columns must have the same length")
    path = joinpath(chapter_data_dir(n), endswith(name, ".csv") ? name : name * ".csv")
    open(path, "w") do io
        println(io, join((csvcell(string(first(c))) for c in columns), ","))
        for i in 1:len
            println(io, join((csvcell(last(c)[i]) for c in columns), ","))
        end
    end
    println("wrote ", relpath(path, ROOT))
    return path
end

"""
    density_csv(n, name, xs, "col" => dist, ...)

Write the density curves of one or more distributions on the grid `xs`, ready
for the `Density` chart: an `x` column plus one column per curve.

    xs = range(0, 12; length = 400)
    density_csv(1, "incomes", xs, "lognormal" => LogNormal(1, 0.6))

For the chart's mean/median markers on a heavy-tailed curve, compute the true
values here (`mean(d)`, `median(d)`) and pass them to the chart as numbers.
"""
function density_csv(n::Integer, name::AbstractString, xs, curves::Pair...)
    cols = ("x" => collect(xs), (first(c) => pdf.(last(c), xs) for c in curves)...)
    return write_csv(n, name, cols...)
end

"Format a number for prose: `fmt(0.8666, 2)` -> \"0.87\"."
fmt(x, digits::Integer = 1) = string(round(x; digits))
fmt(x::Integer) = replace(string(x), r"(?<=\d)(?=(\d{3})+$)" => ",")
