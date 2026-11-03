# PathWise — Today's Tasks
> **Session Date:** 2026-11-01 · **Engineer:** ___________

---

## 🎯 Session Goal
> _Write one sentence describing what you want to have working by the end of this session._
>
> **Goal:** ____________________________________________

---

## ✅ Tasks for This Session

> Pull tasks from `implementation_plan.md`. One task = one checkbox. Do not add more than 5 tasks per session.

- [ ] Task 1: ___________________________________________
  - Files to touch: ___________
  - Test/verify by: ___________

- [ ] Task 2: ___________________________________________
  - Files to touch: ___________
  - Test/verify by: ___________

- [ ] Task 3: ___________________________________________
  - Files to touch: ___________
  - Test/verify by: ___________

- [ ] Task 4: ___________________________________________
  - Files to touch: ___________
  - Test/verify by: ___________

- [ ] Task 5: ___________________________________________
  - Files to touch: ___________
  - Test/verify by: ___________

---

## 🚀 Suggested Starting Tasks (Phase 1 — Fix First)

The following are the highest-priority unblocked tasks from `implementation_plan.md`:

1. **BUG-001** — Add `frontend/dist/` to `.gitignore`
   - File: `PathWise/.gitignore` (create if missing)
   - Verify: `git status` no longer shows `dist/`

2. **BUG-002** — Fix Python path auto-detection in `env.js`
   - File: `backend/src/config/env.js`
   - Verify: `npm run dev` in backend starts without Python spawn error

3. **BUG-003** — Fix garbled UTF-8 in `Map.jsx`
   - File: `frontend/src/components/Map.jsx` (geometryStatus string)
   - Verify: Map loads without encoding artifact in status text

4. **BUG-004** — Refactor nested `<Routes>` in `App.jsx`
   - File: `frontend/src/App.jsx`
   - Verify: All protected routes still render; no console route warnings

5. **BUG-007** — Pass auth token to `rerouteRoute()` in DynamicRerouting
   - File: `frontend/src/pages/DynamicRerouting.jsx`
   - Verify: Rerouting still works when logged in as admin

---

## 📝 Session Notes
> Use this space for observations, decisions made, or things to carry forward.

```
[TIME] [NOTE]
```

---

## 🔚 End of Session Checklist
- [ ] All completed tasks checked in `implementation_plan.md`
- [ ] Any new bugs logged in `bugs.md`
- [ ] Test results recorded in `testing.md`
- [ ] `task_today.md` archived or reset for next session
- [ ] Code changes staged/committed with a descriptive message

