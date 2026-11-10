import Footer from './Footer.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function MainLayout({
  page,
  activePage,
  activeAlerts,
  busy,
  navigate,
  mobileNavOpen,
  onToggleNavigation,
  onRefresh,
  children,
  overlays,
}) {
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        navigate={navigate}
        open={mobileNavOpen}
        onToggle={onToggleNavigation}
        activeAlerts={activeAlerts}
      />
      <div className="app-workspace">
        <Header
          page={activePage || page}
          activeAlerts={activeAlerts}
          busy={busy}
          navigate={navigate}
          onToggleNavigation={onToggleNavigation}
          onRefresh={onRefresh}
        />
        <main className="main-content">{children}</main>
        <Footer navigate={navigate} />
      </div>
      {overlays}
    </div>
  );
}
