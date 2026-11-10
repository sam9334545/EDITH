import Footer from './Footer.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function MainLayout({
  page,
  navigate,
  mobileNavOpen,
  onToggleNavigation,
  onRefresh,
  children,
  overlays,
}) {
  return (
    <div className="app-shell">
      <Header onRefresh={onRefresh} />
      <Sidebar page={page} navigate={navigate} open={mobileNavOpen} onToggle={onToggleNavigation} />
      <main className="main-content">{children}</main>
      <Footer navigate={navigate} />
      {overlays}
    </div>
  );
}
