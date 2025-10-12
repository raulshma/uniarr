import { useConnectorsStore, selectConnectorIds, selectConnectorsCount } from '@/store/connectorsStore';

/**
 * Returns connector ids and count as a small selector-based hook.
 * Use this when components only need connector metadata (IDs/count) and
 * don't require full connector instances to avoid unnecessary re-renders.
 *
 * Note: consumers that select multiple values together can import `shallow`
 * from `zustand/shallow` and pass it to `useConnectorsStore` directly if they
 * need structural equality checks when selecting tuples from the store.
 */
export const useConnectorIds = () => {
  const ids = useConnectorsStore(selectConnectorIds);
  const count = useConnectorsStore(selectConnectorsCount);

  return { ids, count } as { ids: string[]; count: number };
};

export default useConnectorIds;
