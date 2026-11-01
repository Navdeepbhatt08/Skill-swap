import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import AppShell from "./components/AppShell";
import AddSkillModal from "./components/AddSkillModal";
import { createRequest, createSkill, deleteSkill, getDashboard, getMatches, getNotifications, loadSession, clearSession, loadWorkspaceData, updateRequestStatus } from "./services/api";
import Overview from "./pages/Overview";
import Discover from "./pages/Discover";
import Requests from "./pages/Requests";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Chat from "./pages/Chat";
import Schedule from "./pages/Schedule";
import Login from "./pages/Login";

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
  const [skills, setSkills] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [interactionModal, setInteractionModal] = useState(null);
  const [notifications, setNotifications] = useState({ total: 0 });
  const [dashboard, setDashboard] = useState(null);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!authUser) {
      setSkills([]);
      setRequests([]);
      setDashboard(null);
      setMatches([]);
      return;
    }

    loadWorkspaceData()
      .then(([nextSkills, nextRequests]) => {
        setSkills(nextSkills);
        setRequests(nextRequests);
      })
      .catch((err) => {
        if (err?.status === 401) {
          clearSession();
          setAuthUser(null);
        }
      });
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
    getMatches().then(setMatches).catch(() => setMatches([]));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setNotifications({ total: 0 });
      return undefined;
    }

    let active = true;
    const refreshNotifications = () =>
      getNotifications()
        .then((nextNotifications) => {
          if (active) setNotifications(nextNotifications);
        })
        .catch((err) => {
          if (active && err?.status === 401) {
            clearSession();
            setAuthUser(null);
          }
        });

    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authUser]);

  // Filter skills: only show skills that have an owner (posted by a user)
  const discoverableSkills = skills.filter((skill) => skill.owner != null);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  /**
   * Send a targeted skill exchange request to the skill's owner.
   * @param {string} skillName
   * @param {string} skillId
   * @param {{ id: string, name: string }} owner
   * @param {string} type
   */
  const sendRequest = async (skillName, skillId, owner, type = "Learn") => {
    if (!authUser) {
      notify("Log in to send a skill exchange request.");
      return;
    }
    if (!owner || !owner.id) {
      notify("This skill has no owner — request cannot be sent.");
      return;
    }
    if (String(owner.id) === String(authUser.id)) {
      notify("You cannot request your own skill.");
      return;
    }

    const optimistic = {
      id: `local-${Date.now()}`,
      from: authUser.name || "You",
      fromId: authUser.id,
      to: owner.name,
      toId: owner.id,
      skill: skillName,
      type,
      status: "Pending",
      isMine: true,
      date: "Just now",
    };
    setRequests((current) => [optimistic, ...current]);
    setShowModal(false);
    notify(`Request sent to ${owner.name} for ${skillName}!`);
    try {
      const saved = await createRequest(skillName, skillId, owner.id, type);
      // Replace the optimistic entry with the real one from the server
      setRequests((current) =>
        current.map((r) => (r.id === optimistic.id ? { ...saved, isMine: true } : r))
      );
    } catch (err) {
      notify(err.message || "Could not send request.");
      setRequests((current) => current.filter((r) => r.id !== optimistic.id));
    }
  };

  /**
   * Accept or decline an incoming request.
   */
  const handleRequestAction = async (requestId, status) => {
    try {
      const updated = await updateRequestStatus(requestId, status);
      setRequests((current) =>
        current.map((r) => (String(r.id) === String(requestId) ? { ...r, ...updated } : r))
      );
      if (status === "Accepted") {
        notify("Request accepted! Contact details are now visible.");
      } else {
        notify("Request declined.");
      }
    } catch (err) {
      notify(err.message || "Could not update request.");
    }
  };

  const addSkill = async (name, category) => {
    const skill = {
      id: `new-${Date.now()}`,
      name,
      category,
      level: "Beginner",
      color: "mint",
      learners: 0,
      owner: { id: authUser?.id, name: authUser?.name },
    };

    setSkills((current) => [...current, skill]);
    setShowModal(false);
    notify(`${name} added to your skills.`);
    try {
      await createSkill(name, category);
    } catch {
      /* optimistic UI keeps demo mode usable */
    }
  };

  const removeSkill = async (skill) => {
    if (!window.confirm(`Delete "${skill.name}" from your skills?`)) return;
    try {
      await deleteSkill(skill._id || skill.id);
      setSkills((current) =>
        current.filter((item) => String(item._id || item.id) !== String(skill._id || skill.id)),
      );
      notify(`${skill.name} deleted from your skills.`);
    } catch (err) {
      notify(err.message || "Could not delete skill.");
    }
  };

  const logout = () => {
    clearSession();
    setAuthUser(null);
  };

  if (!authUser) {
    return (
      <AppShell
        activePage="Overview"
        requestCount={0}
        currentUser={{ name: "Guest learner", department: "Preview mode", avatar: "GS" }}
        publicMode
        isAdmin={false}
        onNavigate={() => notify("Log in to explore this workspace.")}
        onNotify={notify}
        onLogin={() => setShowModal("login")}
      >
        <PageHeading activePage="Overview" showAction={false} />
        <Overview
          skills={skills}
          onAddSkill={() => setShowModal("login")}
          onRequest={() => setShowModal("login")}
          setPage={() => setShowModal("login")}
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
        dashboard={dashboard}
        onRequest={sendRequest}
        onAddSkill={() => setShowModal(true)}
        setPage={setActivePage}
      />
    ),
    "Discover skills": (
      <Discover
        skills={discoverableSkills}
        matches={matches}
        query={query}
        setQuery={setQuery}
        onRequest={sendRequest}
        currentUserId={authUser?.id}
      />
    ),
    Chat: <Chat currentUserId={authUser.id} />,
    Schedule: <Schedule currentUserId={authUser.id} />,
    Requests: (
      <Requests
        requests={requests}
        currentUserId={authUser?.id}
        onAction={handleRequestAction}
        onOpenChat={(userId) => setInteractionModal({ type: "chat", userId })}
        onOpenSchedule={(userId, skill) => setInteractionModal({ type: "schedule", userId, skill })}
        notificationCount={notifications.total}
      />
    ),
    "My profile": (
      <Profile
        user={authUser}
        skills={skills}
        onAddSkill={() => setShowModal(true)}
        onRequest={sendRequest}
        onDeleteSkill={removeSkill}
      />
    ),
    "Admin panel": <Admin user={authUser} />,
  }[activePage];

  return (
    <AppShell
      activePage={activePage}
      requestCount={requests.filter((r) => !r.isMine && r.status === "Pending").length}
      notificationCount={notifications.total}
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
      {showModal && showModal !== "login" && (
        <AddSkillModal onClose={() => setShowModal(false)} onAdd={addSkill} />
      )}
      {interactionModal && (
        <div className="interaction-modal-backdrop" role="presentation">
          <section className="interaction-modal" role="dialog" aria-modal="true" aria-label={interactionModal.type === "chat" ? "Chat" : "Schedule session"}>
            <button
              type="button"
              className="interaction-modal-close"
              onClick={() => setInteractionModal(null)}
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
            </button>
            {interactionModal.type === "chat" ? (
              <Chat currentUserId={authUser.id} initialUserId={interactionModal.userId} />
            ) : (
              <Schedule
                currentUserId={authUser.id}
                initialUserId={interactionModal.userId}
                initialSkill={interactionModal.skill}
              />
            )}
          </section>
        </div>
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
