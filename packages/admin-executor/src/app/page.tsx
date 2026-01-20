"use client";

import { useEffect, useState } from "react";

interface ApiResult {
  ok: boolean;
  message?: string;
  [key: string]: unknown;
}

interface UserSnapshot {
  plan: string;
  orgId: string | null;
}

interface OrgSnapshot {
  tier: string;
  credit: number;
}

interface UserOrgDetail {
  id: string;
  tier: string;
  credit: number;
}

type NavKey = "overview" | "users" | "orgs" | "plans" | "billing" | "audit";

const planPresets = ["free", "pro", "enterprise"];
const tierPresets = ["free", "team", "pro", "enterprise"];

export default function Page() {
  const [token, setToken] = useState<string>("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [status, setStatus] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("대기 중...");
  const [activeNav, setActiveNav] = useState<NavKey>("overview");

  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState("pro");
  const [userOrgId, setUserOrgId] = useState("");
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot | null>(null);
  const [userOrgDetail, setUserOrgDetail] = useState<UserOrgDetail | null>(null);

  const [orgId, setOrgId] = useState("");
  const [tier, setTier] = useState("pro");
  const [orgSnapshot, setOrgSnapshot] = useState<OrgSnapshot | null>(null);
  const [creditAbsolute, setCreditAbsolute] = useState("");
  const [creditDelta, setCreditDelta] = useState("");

  const [userList, setUserList] = useState<
    Array<{ id: string; plan: string; orgId: string | null }>
  >([]);
  const [orgList, setOrgList] = useState<
    Array<{ id: string; tier: string; credit: number }>
  >([]);
  const [listStatus, setListStatus] = useState<string | null>(null);

  const maskedToken = token
    ? `${token.slice(0, 6)}...${token.slice(-4)}`
    : "-";

  useEffect(() => {
    const stored = window.localStorage.getItem("adminToken");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void loadUserList();
      void loadOrgList();
    }
  }, [token]);

  function persistToken(nextToken: string) {
    setToken(nextToken);
    if (nextToken) {
      window.localStorage.setItem("adminToken", nextToken);
    } else {
      window.localStorage.removeItem("adminToken");
    }
  }

  async function requestApi(
    path: string,
    method: "GET" | "POST",
    payload?: Record<string, unknown>,
  ): Promise<ApiResult | null> {
    setStatus(null);
    setOutput("요청 중...");

    const response = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
    });

    let result: ApiResult | null = null;
    try {
      result = (await response.json()) as ApiResult;
    } catch {
      result = { ok: false, message: "invalid_response" };
    }

    setStatus(response.ok ? "성공" : "실패");
    setOutput(JSON.stringify(result, null, 2));

    return result;
  }

  async function fetchList(path: string) {
    const response = await fetch(path, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    let result: ApiResult | null = null;
    try {
      result = (await response.json()) as ApiResult;
    } catch {
      result = { ok: false, message: "invalid_response" };
    }

    if (!response.ok || !result?.ok) {
      setListStatus(result?.message ?? "list_fetch_failed");
      return null;
    }

    setListStatus("ok");
    return result;
  }

  async function loadUserList() {
    const result = await fetchList("/api/admin/users");
    if (result?.users && Array.isArray(result.users)) {
      setUserList(
        result.users.map((item: { id: string; plan: string; orgId?: string }) => ({
          id: String(item.id),
          plan: String(item.plan ?? "free"),
          orgId: item.orgId ? String(item.orgId) : null,
        })),
      );
    }
  }

  async function loadOrgList() {
    const result = await fetchList("/api/admin/orgs");
    if (result?.orgs && Array.isArray(result.orgs)) {
      setOrgList(
        result.orgs.map((item: { id: string; tier: string; credit?: number }) => ({
          id: String(item.id),
          tier: String(item.tier ?? "free"),
          credit: Number(item.credit ?? 0),
        })),
      );
    }
  }

  async function handleLogin() {
    setStatus(null);
    setOutput("로그인 시도 중...");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const result = (await response.json()) as ApiResult & {
      accessToken?: string;
    };

    if (!response.ok || !result.accessToken) {
      setStatus("로그인 실패");
      setOutput(JSON.stringify(result, null, 2));
      return;
    }

    persistToken(result.accessToken);
    setActiveNav("overview");
    setStatus("로그인 성공");
    setOutput(JSON.stringify(result, null, 2));
  }

  function handleLogout() {
    persistToken("");
    setStatus("로그아웃 완료");
    setOutput("토큰을 삭제했습니다.");
  }

  async function fetchUserSnapshot() {
    if (!userId) return;
    const result = await requestApi(`/api/admin/users/${userId}/detail`, "GET");
    if (result?.ok) {
      const planValue = String(result.plan ?? "free");
      const orgValue = result.org?.id ? String(result.org.id) : "";
      setUserSnapshot({ plan: planValue, orgId: orgValue || null });
      if (result.org) {
        setUserOrgDetail({
          id: String(result.org.id),
          tier: String(result.org.tier ?? "free"),
          credit: Number(result.org.credit ?? 0),
        });
      } else {
        setUserOrgDetail(null);
      }
      setPlan(planValue);
      setUserOrgId(orgValue);
    }
  }

  async function fetchOrgSnapshot() {
    if (!orgId) return;
    const result = await requestApi(`/api/admin/orgs/${orgId}`, "GET");
    if (result?.ok) {
      const tierValue = String(result.tier ?? "free");
      const creditValue = Number(result.credit ?? 0);
      setOrgSnapshot({ tier: tierValue, credit: creditValue });
      setTier(tierValue);
    }
  }

  async function updatePlan() {
    if (!userId || !plan) return;
    await requestApi(`/api/admin/users/${userId}/plan/grant`, "POST", { plan });
    await fetchUserSnapshot();
  }

  async function assignOrg() {
    if (!userId || !userOrgId) return;
    await requestApi(`/api/admin/users/${userId}/org/assign`, "POST", {
      orgId: userOrgId,
    });
    await fetchUserSnapshot();
  }

  async function updateTier() {
    if (!orgId || !tier) return;
    await requestApi(`/api/admin/orgs/${orgId}/tier/update`, "POST", { tier });
    await fetchOrgSnapshot();
  }

  async function applyCreditAbsolute() {
    if (!orgId || !creditAbsolute) return;
    await requestApi(`/api/admin/orgs/${orgId}/credit/update`, "POST", {
      credit: creditAbsolute,
    });
    await fetchOrgSnapshot();
  }

  async function adjustCredit(direction: 1 | -1) {
    if (!orgId || !creditDelta) return;
    const deltaValue = Number(creditDelta);
    if (!Number.isFinite(deltaValue) || deltaValue <= 0) {
      setStatus("실패");
      setOutput("creditDelta는 양수 숫자여야 합니다.");
      return;
    }
    await requestApi(`/api/admin/orgs/${orgId}/credit/update`, "POST", {
      creditDelta: direction * deltaValue,
    });
    await fetchOrgSnapshot();
  }

  const isAuthenticated = Boolean(token);

  function renderOverview() {
    return (
      <>
        <section className="grid columns-3">
          <div className="card">
            <h3>Flow</h3>
            <p>Login → Lookup → Execute → Verify</p>
          </div>
          <div className="card">
            <h3>Session</h3>
            <p>Token: {maskedToken}</p>
          </div>
          <div className="card">
            <h3>Quick Select</h3>
            <p>리스트에서 대상 선택</p>
          </div>
        </section>
        <section className="grid columns-4">
          <div className="card">
            <p>선택된 사용자</p>
            <h3>{userId || "-"}</h3>
          </div>
          <div className="card">
            <p>현재 Plan</p>
            <h3>{userSnapshot?.plan ?? "-"}</h3>
          </div>
          <div className="card">
            <p>소속 Org</p>
            <h3>{userSnapshot?.orgId ?? "-"}</h3>
          </div>
          <div className="card">
            <p>Org Credit</p>
            <h3>{orgSnapshot ? String(orgSnapshot.credit) : "-"}</h3>
          </div>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <div className="grid columns-2">
        <div className="card">
          <h3>사용자 Plan & Org</h3>
          <div className="field">
            User ID
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="field">
            Plan
            <input value={plan} onChange={(e) => setPlan(e.target.value)} />
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {planPresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            Org ID
            <input value={userOrgId} onChange={(e) => setUserOrgId(e.target.value)} />
          </div>
          <div className="grid columns-2">
            <button className="btn outline" onClick={fetchUserSnapshot}>
              조회
            </button>
            <button className="btn secondary" onClick={updatePlan}>
              Plan 적용
            </button>
          </div>
          <button className="btn" onClick={assignOrg}>
            Org 소속 변경
          </button>
          <p>
            현재 Plan: {userSnapshot?.plan ?? "-"} / Org: {userSnapshot?.orgId ?? "-"}
          </p>
        </div>
        <div className="card">
          <h3>사용자 리스트</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Plan</th>
                <th>Org</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.plan}</td>
                  <td>{item.orgId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderOrgs() {
    return (
      <div className="grid columns-2">
        <div className="card">
          <h3>Org Tier</h3>
          <div className="field">
            Org ID
            <input value={orgId} onChange={(e) => setOrgId(e.target.value)} />
          </div>
          <div className="field">
            Tier
            <input value={tier} onChange={(e) => setTier(e.target.value)} />
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {tierPresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
          <button className="btn secondary" onClick={updateTier}>
            Tier 변경
          </button>
          <button className="btn outline" onClick={fetchOrgSnapshot}>
            조회
          </button>
          <p>현재 Tier: {orgSnapshot?.tier ?? "-"}</p>
        </div>
        <div className="card">
          <h3>조직 리스트</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tier</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {orgList.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.tier}</td>
                  <td>{item.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderBilling() {
    return (
      <div className="grid columns-2">
        <div className="card">
          <h3>Org Credit</h3>
          <div className="field">
            Org ID
            <input value={orgId} onChange={(e) => setOrgId(e.target.value)} />
          </div>
          <div className="field">
            Credit (절대값)
            <input
              value={creditAbsolute}
              onChange={(e) => setCreditAbsolute(e.target.value)}
            />
          </div>
          <button className="btn secondary" onClick={applyCreditAbsolute}>
            Credit 설정
          </button>
          <div className="field">
            Credit 증감
            <input value={creditDelta} onChange={(e) => setCreditDelta(e.target.value)} />
          </div>
          <div className="grid columns-2">
            <button className="btn" onClick={() => adjustCredit(1)}>
              증액
            </button>
            <button className="btn outline" onClick={() => adjustCredit(-1)}>
              감액
            </button>
          </div>
          <p>현재 Credit: {orgSnapshot?.credit ?? "-"}</p>
        </div>
      </div>
    );
  }

  function renderAudit() {
    return (
      <div className="card">
        <h3>실행 결과</h3>
        <div className="log">{output}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>ADMIN</span>
          <strong>Executor</strong>
        </div>
        <div className="nav-group">
          <div className="nav-title">Core</div>
          <div className="nav-list">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "users", label: "Users" },
                { id: "orgs", label: "Organizations" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                onClick={() => setActiveNav(item.id)}
                disabled={!isAuthenticated}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nav-group">
          <div className="nav-title">Billing</div>
          <div className="nav-list">
            {(
              [
                { id: "plans", label: "Plans" },
                { id: "billing", label: "Billing" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                onClick={() => setActiveNav(item.id)}
                disabled={!isAuthenticated}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nav-group">
          <div className="nav-title">Audit</div>
          <div className="nav-list">
            <button
              className={`nav-item ${activeNav === "audit" ? "active" : ""}`}
              onClick={() => setActiveNav("audit")}
              disabled={!isAuthenticated}
            >
              Audit
            </button>
          </div>
        </div>
        <div className="sidebar-footer">
          <div>Token: {maskedToken}</div>
          <button onClick={handleLogout} disabled={!isAuthenticated}>
            로그아웃
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <div className="title">
            <span>Console</span>
            <strong>{activeNav.toUpperCase()}</strong>
          </div>
          <div className="grid" style={{ gridAutoFlow: "column" }}>
            <input placeholder="Search user/org..." />
            <span className="badge">{token ? "Authenticated" : "Guest"}</span>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="panel">
            <h2>Admin Login</h2>
            <p>내부 콘솔 진입을 위해 관리자 계정으로 로그인하세요.</p>
            <div className="card">
              <div className="field">
                ID
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid columns-2">
                <button className="btn" onClick={handleLogin}>
                  토큰 발급
                </button>
                <button className="btn outline" onClick={handleLogout}>
                  토큰 삭제
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeNav === "overview" && renderOverview()}
        {activeNav === "users" && renderUsers()}
        {activeNav === "orgs" && renderOrgs()}
        {activeNav === "billing" && renderBilling()}
        {activeNav === "plans" && renderUsers()}
        {activeNav === "audit" && renderAudit()}
      </main>
    </div>
  );
}
