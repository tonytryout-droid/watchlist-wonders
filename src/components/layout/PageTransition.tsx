import { useEffect, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [activeKey, setActiveKey] = useState(location.key);

  useEffect(() => {
    if (location.key === activeKey) return;
    // Fade out, swap key (shows new route content), fade in
    setVisible(false);
    const t = setTimeout(() => {
      setActiveKey(location.key);
      setVisible(true);
    }, 120);
    return () => clearTimeout(t);
  }, [location.key, activeKey]);

  return (
    <div
      style={{
        transition: "opacity 0.2s ease",
        opacity: visible ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
