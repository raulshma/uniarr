Zustand store guidelines
=========================

Small guidance for working with Zustand stores in this repository.

Principles
- Use selectors when consuming stores in components. Selectors scope subscriptions to only the data needed.
- When selecting multiple values (tuples or small objects), prefer `shallow` from `zustand/shallow` to avoid re-renders on new references.
- Limit persisted state to small slices using `partialize` on the `persist` middleware. Persisting entire stores can slow rehydration.
- Avoid performing heavy computations synchronously inside `onRehydrateStorage`. Defer or run lazily if possible.

Examples

- Select a single function/value safely:

```ts
const getConnector = useConnectorsStore(selectGetConnector);
const connector = getConnector(serviceId);
```

- Select multiple primitives with shallow equality:

```ts
import { shallow } from 'zustand/shallow';

const [ids, count] = useConnectorsStore((s) => [selectConnectorIds(s), selectConnectorsCount(s)], shallow);
```

- Limit persisted keys using `partialize` (example in `settingsStore.ts`): only persist the minimal keys required.

If in doubt, prefer creating a small helper hook (for example `useConnectorIds`) that encapsulates selector logic and reuse it across components.
