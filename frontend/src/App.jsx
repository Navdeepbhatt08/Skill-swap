import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import AppShell from "./components/AppShell";
import AddSkillModal from "./components/AddSkillModal";
import { createRequest, createSkill, loadSession, clearSession, loadWorkspaceData } from "./services/api";
import Overview from "./pages/Overview";
import Discover from "./pages/Discover";
import Connections from "./pages/Connections";
import Requests from "./pages/Requests";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import SkillManagement from "./pages/SkillManagement";
import Login from "./pages/Login";
import { fallbackSkills, fallbackUsers } from "./data/fallbackData";

function PageHeading({ activePage, onAddSkill, showAction = true }) {
  return (
    <section className="page-heading">
      <div>

        <h1>
          {activePage === "Overview" ? (
            <>
              Make progress <em>together.</em>
            </>
          ) : (
            activePage
          )}
        </h1>
        <p className="heading-copy">
          {activePage === "Overview"
            ? "Trade what you know for what you want to learn."
            : "Find your next meaningful learning exchange."}
        </p>
      </div>
      {showAction && (
        <button className="primary-button" onClick={onAddSkill}>
          <Plus size={17} /> Add a skill
        </button>
      )}
    </section>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(loadSession);
  const [activePage, setActivePage] = useState("Overview");
  const [skills, setSkills] = useState(fallbackSkills);
  const [users, setUsers] = useState(fallbackUsers);
  const [requests, setRequests] = useState([
    { id: "demo-1", from: "Maya Chen", skill: "JavaScript", type: "Learn", status: "Pending", date: "Today" },
    { id: "demo-2", from: "Noah Williams", skill: "Public Speaking", type: "Exchange", status: "Accepted", date: "Yesterday" },
  ]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    loadWorkspaceData().then(([nextSkills, nextUsers, nextRequests]) => {
      setSkills(nextSkills);
      setUsers(nextUsers);
      setRequests(nextRequests);
    }).catch(() => {
      clearSession();
      setAuthUser(null);
    });
  }, [authUser]);

  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) =>
        `${skill.name} ${skill.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [skills, query],
  );
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };
  const sendRequest = async (skill, type = "Learn") => {
    if (!authUser) {
      notify("Log in to send a skill exchange request.");
      return;
    }
    const optimistic = {
      id: `local-${Date.now()}`,
      from: "You",
      skill,
      type,
      status: "Pending",
      date: "Just now",
    };
    setRequests((current) => [optimistic, ...current]);
    setShowModal(false);
    notify(`Your ${type.toLowerCase()} request for ${skill} is on its way.`);
    try {
      await createRequest(skill, type);
    } catch {
      /* optimistic UI keeps demo mode usable */
    }
  };
  const addSkill = async (name) => {
    const skill = {
      id: `new-${Date.now()}`,
      name,
      category: "New",
      level: "Beginner",
      color: "mint",
      learners: 0,
    };
    setSkills((current) => [...current, skill]);
    setShowModal(false);
    notify(`${name} added to your skills.`);
    try {
      await createSkill(name);
    } catch {
      /* optimistic UI keeps demo mode usable */
    }
  };
  const logout = () => { clearSession(); setAuthUser(null); };

  if (!authUser) {
    return (
      <AppShell
        activePage="Overview"
        requestCount={requests.length}
        currentUser={{ name: "Guest learner", department: "Preview mode", avatar: "GS" }}
        publicMode
        isAdmin={false}
        onNavigate={() => notify("Log in to explore this workspace.")}
        onNotify={notify}
        onLogin={() => setShowModal("login")}
      >
        <PageHeading activePage="Overview" showAction={false} />
        <Overview
          onAddSkill={() => setShowModal("login")}
          setPage={() => notify("Log in to explore the full community.")}
        />
        {notice && <div className="toast"><Check size={16} />{notice}</div>}
        {showModal === "login" && <Login onLogin={setAuthUser} onClose={() => setShowModal(false)} />}
      </AppShell>
    );
  }

  const page = {
    Overview: (
      <Overview
        skills={skills}
        requests={requests}
        onRequest={sendRequest}
        onAddSkill={() => setShowModal(true)}
        setPage={setActivePage}
      />
    ),
    "Discover skills": (
      <Discover
        skills={filteredSkills}
        query={query}
        setQuery={setQuery}
        onRequest={sendRequest}
      />
    ),
    "Skill management": (
      <SkillManagement
        skills={skills}
        onAddSkill={() => setShowModal(true)}
        onRequest={sendRequest}
      />
    ),
    "My connections": <Connections users={users} onRequest={sendRequest} />,
    Requests: <Requests requests={requests} />,
    "My profile": <Profile user={authUser} onRequest={sendRequest} />,
    "Admin panel": <Admin user={authUser} />,
  }[activePage];

  return (
    <AppShell
      activePage={activePage}
      requestCount={requests.length}
      currentUser={authUser}
      isAdmin={authUser.role === "admin"}
      onNavigate={setActivePage}
      onNotify={notify}
      onLogout={logout}
    >
      <PageHeading
        activePage={activePage}
        onAddSkill={() => setShowModal(true)}
        showAction={activePage !== "Overview"}
      />
      {page}
      {showModal && (
        <AddSkillModal onClose={() => setShowModal(false)} onAdd={addSkill} />
      )}
      {notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </AppShell>
  );
}
