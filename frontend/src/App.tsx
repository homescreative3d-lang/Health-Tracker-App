import { CareAppContext } from "./hooks/CareAppContext";
import { useCareApp } from "./hooks/useCareApp";
import { TopBar } from "./components/TopBar";
import { Toast } from "./components/Toast";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ForgotScreen } from "./screens/auth/ForgotScreen";
import { ResetScreen } from "./screens/auth/ResetScreen";
import { RoleScreen } from "./screens/onboarding/RoleScreen";
import { PatientScreen } from "./screens/onboarding/PatientScreen";
import { Hub } from "./screens/hub/Hub";
import { GuideModal } from "./screens/modals/GuideModal";
import { MedicineWizard } from "./screens/modals/MedicineWizard";
import { NotificationPopover } from "./screens/notifications/NotificationPopover";
import { NotificationDetailModal } from "./screens/notifications/NotificationDetailModal";
import { blank } from "./constants/options";

/**
 * Root component: creates the app controller, provides it via context and routes
 * between the auth, onboarding and hub screens. All state and behavior live in
 * `useCareApp`; this file only composes the UI.
 */
export default function App() {
  const app = useCareApp();

  if (app.loading)
    return (
      <div className="center splash" role="status" aria-live="polite">
        <div className="loading-mark">
          <img src="/tended-icon.svg" alt="" />
        </div>
        <p>Loading your care plan…</p>
      </div>
    );

  return (
    <CareAppContext.Provider value={app}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TopBar />
        <main id="main" className={app.screen === "hub" ? "main main-hub" : "main"}>
          {app.screen === "login" && (
            <LoginScreen
              onSuccess={app.onAuth}
              onForgot={() => app.setScreen("forgot")}
              onError={(m) => app.flash(m, true)}
            />
          )}
          {app.screen === "forgot" && (
            <ForgotScreen onBack={() => app.setScreen("login")} onSent={(m) => app.flash(m)} />
          )}
          {app.screen === "reset" && (
            <ResetScreen
              onDone={(m) => {
                history.replaceState(null, "", "/");
                app.flash(m);
                app.setScreen("login");
              }}
              onBack={() => {
                history.replaceState(null, "", "/");
                app.setScreen("login");
              }}
            />
          )}
          {app.screen === "role" && (
            <RoleScreen onPick={(r) => app.chooseRole(r)} onSkip={() => app.chooseRole(null)} />
          )}
          {app.screen === "patient" && app.patient && (
            <PatientScreen
              patient={app.patient}
              role={app.patient.relationship === "self" ? "self" : app.onboardingRole}
              onBack={app.cancelPatientForm}
              onSave={app.savePatient}
            />
          )}
          {app.screen === "hub" && app.patient && app.user && <Hub />}
        </main>

        {app.guide && <GuideModal onClose={() => app.setGuide(false)} />}
        {app.notificationOpen && app.user && (
          <NotificationPopover
            notifications={app.notifications}
            patients={app.patients}
            onClose={() => app.setNotificationOpen(false)}
            onRead={app.readNotification}
            onReadAll={app.readAllNotifications}
            onSelect={app.openNotification}
          />
        )}
        {app.selectedNotification && (
          <NotificationDetailModal
            notification={app.selectedNotification}
            patients={app.patients}
            onClose={() => app.setSelectedNotification(null)}
            onOpenFamily={() => {
              app.setSelectedNotification(null);
              app.setTab("family");
            }}
          />
        )}
        {app.wizard && (
          <MedicineWizard
            initial={app.editing || blank()}
            isEdit={!!app.editing}
            patientName={app.patient?.name}
            onClose={app.closeWizard}
            onSave={app.saveMedicine}
          />
        )}
        <Toast toast={app.toast} onDismiss={app.dismissToast} />
      </div>
    </CareAppContext.Provider>
  );
}
