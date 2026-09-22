import { LibraryBig, Plus, Search } from "lucide-react";

export default function Overview({ onAddSkill, setPage }) {
  return (
    <section className="dashboard-actions-panel mx-auto grid max-w-5xl gap-10">
      <div className="dashboard-actions-copy min-w-0">
        <span className="eyebrow">Your learning space</span>
        <h2>What would you like to do?</h2>
        <p>Share what you know or find your next skill to learn.</p>
      </div>
      <div className="dashboard-actions grid w-full gap-3">
        <div className="dashboard-skill-actions grid w-full grid-cols-2 gap-3">
          <button className="primary-button flex w-full items-center justify-center" onClick={onAddSkill}>
            <Plus size={17} /> Add skills
          </button>
          <button className="outline-button flex w-full items-center justify-center" onClick={() => setPage("Discover skills")}>
            <Search size={17} /> Find skills
          </button>
        </div>
        <button className="outline-button dashboard-library-action flex w-full items-center justify-center" onClick={() => setPage("Discover skills")}>
          <LibraryBig size={17} /> Browse library
        </button>
      </div>
    </section>
  );
}
