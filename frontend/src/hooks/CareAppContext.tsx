import { createContext, useContext } from "react";
import type { CareApp } from "./useCareApp";

/** Context carrying the app controller so screens don't need 20+ props. */
export const CareAppContext = createContext<CareApp | null>(null);

/**
 * Reads the app controller.
 * @throws Error when used outside `<CareAppContext.Provider>`.
 */
export function useCare(): CareApp {
  const value = useContext(CareAppContext);
  if (!value) throw new Error("useCare must be used inside CareAppContext.Provider");
  return value;
}
