import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SavedPortfolio } from "@/context/portfolio-context";

function portfoliosRef(uid: string) {
  return collection(db, "users", uid, "portfolios");
}

export async function fetchCloudPortfolios(uid: string): Promise<SavedPortfolio[]> {
  const snap = await getDocs(portfoliosRef(uid));
  return snap.docs.map((d) => d.data() as SavedPortfolio);
}

export async function upsertPortfolio(uid: string, portfolio: SavedPortfolio): Promise<void> {
  const ref = doc(db, "users", uid, "portfolios", portfolio.id);
  await setDoc(ref, portfolio);
}

export async function removePortfolio(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "portfolios", id));
}

export function subscribePortfolios(
  uid: string,
  onUpdate: (portfolios: SavedPortfolio[]) => void
): Unsubscribe {
  return onSnapshot(portfoliosRef(uid), (snap) => {
    onUpdate(snap.docs.map((d) => d.data() as SavedPortfolio));
  });
}
