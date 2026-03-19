"use client";

import { createContext, useContext, useState } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isOpen: false,
  toggle: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // 閉じた状態をデフォルトにする
  const [isOpen, setIsOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ isOpen, toggle: () => setIsOpen((v) => !v) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
