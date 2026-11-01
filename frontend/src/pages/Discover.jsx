import { useMemo, useState } from "react";
import { ListFilter, Search, SearchX, X } from "lucide-react";
import SkillCard from "../components/SkillCard";

export default function Discover({ skills = [], matches = [], query = "", setQuery, onRequest }) {
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const categories = useMemo(
    () =>
      [...new Set(
        skills
          .map((skill) => skill.category?.trim())
          .filter(Boolean),
      )].sort((first, second) => first.localeCompare(second)),
    [skills],
  );

  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) => {
        const matchesQuery =
          !normalizedQuery ||
          `${skill.name || ""} ${skill.category || ""}`
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesCategory =
          selectedCategory === "All categories" ||
          skill.category === selectedCategory;
        return matchesQuery && matchesCategory;
      }),
    [normalizedQuery, selectedCategory, skills],
  );

  const hasActiveFilters = hasQuery || selectedCategory !== "All categories";
  const resultLabel = `${filteredSkills.length} ${
    filteredSkills.length === 1 ? "skill" : "skills"
  } available`;

  const clearFilters = () => {
    setQuery("");
    setSelectedCategory("All categories");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
      {matches.length > 0 && (
        <div className="border-b border-[var(--border)] bg-indigo-50/50 px-4 py-4 sm:px-6 lg:px-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Reciprocal matches</p>
          <div className="flex flex-wrap gap-2">
            {matches.slice(0, 3).map((match) => (
              <span className="pill" key={match.user.id}>{match.user.name}: {match.score}% match</span>
            ))}
          </div>
        </div>
      )}
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-indigo-50/70 via-white to-white px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Explore the community
          </p>
          <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Find a skill to exchange
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Search by skill or category and start learning together.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-3.5 shadow-[var(--shadow-xs)] transition focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-indigo-500/10">
            <Search size={18} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills, categories..."
              aria-label="Search skills and categories"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted-light)]"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="sr-only" htmlFor="skill-category-filter">
              Filter by category
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 shadow-[var(--shadow-xs)]">
              <ListFilter size={16} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
              <select
                id="skill-category-filter"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="bg-transparent py-2.5 pr-1 text-sm font-medium text-[var(--ink)] outline-none"
              >
                <option>All categories</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <span
              className="shrink-0 text-xs font-semibold text-[var(--muted)] sm:text-right"
              aria-live="polite"
            >
              {resultLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-7">
        {filteredSkills.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill) => (
              <SkillCard key={skill._id || skill.id} skill={skill} onRequest={onRequest} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface-subtle)] px-5 py-12 text-center">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-[var(--primary)]">
              <SearchX size={23} aria-hidden="true" />
            </span>
            <h3 className="mb-1 text-base font-bold text-[var(--ink)]">
              No matching skills
            </h3>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              {hasQuery
                ? `We couldn't find anything for "${query.trim()}". Try a broader search.`
                : selectedCategory !== "All categories"
                  ? `There are no ${selectedCategory} skills available right now.`
                  : "There are no skills to show right now. Check back soon."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
