import { mutationQueueService } from "@/services/storage/MutationQueueService";
import { storageAdapter } from "@/services/storage/StorageAdapter";

jest.mock("@/services/storage/StorageAdapter", () => ({
  storageAdapter: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    debug: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("MutationQueueService", () => {
  const mockStorageAdapter = storageAdapter as jest.Mocked<
    typeof storageAdapter
  >;
  const memoryStore = new Map<string, string>();

  const resetServiceState = () => {
    const service = mutationQueueService as any;
    service.isInitialized = false;
    service.queue = [];
    service.processingQueue = false;
    service.runtimeMutationFns = new Map();
    service.mutationHandlers = new Map();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    memoryStore.clear();

    mockStorageAdapter.getItem.mockImplementation(async (key: string) =>
      memoryStore.has(key) ? (memoryStore.get(key) ?? null) : null,
    );
    mockStorageAdapter.setItem.mockImplementation(
      async (key: string, value: string) => {
        memoryStore.set(key, value);
      },
    );
    mockStorageAdapter.removeItem.mockImplementation(async (key: string) => {
      memoryStore.delete(key);
    });
    mockStorageAdapter.getAllKeys.mockImplementation(async () =>
      Array.from(memoryStore.keys()),
    );
    mockStorageAdapter.clear.mockImplementation(async () => {
      memoryStore.clear();
    });

    resetServiceState();
  });

  it("resolves runtime mutation function in current session", async () => {
    const mutationFn = jest.fn().mockResolvedValue(undefined);

    await mutationQueueService.addMutation({
      mutationFn,
      queryKey: ["offline", "action"],
      variables: { id: "abc" },
      maxRetries: 3,
    });

    const pending = await mutationQueueService.getPendingMutations();
    expect(pending).toHaveLength(1);

    const executor = mutationQueueService.resolveMutationExecutor(pending[0]!);
    expect(executor).not.toBeNull();

    await executor!();
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("persists serializable payload without mutation function", async () => {
    const mutationFn = jest.fn().mockResolvedValue(undefined);

    const id = await mutationQueueService.addMutation({
      mutationFn,
      queryKey: ["offline", "action"],
      variables: { id: "persist-check" },
      maxRetries: 2,
    });

    const raw = memoryStore.get(`MutationQueue_pending_${id}`);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.id).toBe(id);
    expect(parsed.queryKey).toEqual(["offline", "action"]);
    expect(parsed.variables).toEqual({ id: "persist-check" });
    expect(parsed.maxRetries).toBe(2);
    expect(parsed.mutationFn).toBeUndefined();
  });

  it("hydrates and resolves operation-key mutations after restart", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);

    mutationQueueService.registerMutationHandler(
      "sync.service.refresh",
      handler,
    );

    const id = await mutationQueueService.addMutation({
      operationKey: "sync.service.refresh",
      payload: { serviceId: "sonarr-1" },
      queryKey: ["offline", "action"],
      variables: { reason: "network-reconnect" },
      maxRetries: 3,
    });

    // Simulate app restart: clear in-memory state, keep persisted storage map.
    resetServiceState();

    mutationQueueService.registerMutationHandler(
      "sync.service.refresh",
      handler,
    );
    await mutationQueueService.initialize();

    const pending = await mutationQueueService.getPendingMutations();
    const restored = pending.find((mutation) => mutation.id === id);

    expect(restored).toBeDefined();
    const executor = mutationQueueService.resolveMutationExecutor(restored!);
    expect(executor).not.toBeNull();

    await executor!();

    expect(handler).toHaveBeenCalledWith(
      { serviceId: "sonarr-1" },
      { reason: "network-reconnect" },
    );
  });

  it("rejects enqueue requests with no execution strategy", async () => {
    await expect(
      mutationQueueService.addMutation({
        queryKey: ["offline", "action"],
        maxRetries: 3,
      } as any),
    ).rejects.toThrow(
      "Queued mutation requires either mutationFn or operationKey",
    );
  });

  it("cleans malformed persisted queue entries during initialization", async () => {
    memoryStore.set("MutationQueue_index", JSON.stringify(["bad-id"]));
    memoryStore.set(
      "MutationQueue_pending_bad-id",
      JSON.stringify({ id: "bad-id" }),
    );

    await mutationQueueService.initialize();

    const pending = await mutationQueueService.getPendingMutations();
    expect(pending).toHaveLength(0);

    expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
      "MutationQueue_pending_bad-id",
    );

    const indexRaw = memoryStore.get("MutationQueue_index");
    expect(indexRaw).toBeDefined();
    expect(JSON.parse(indexRaw!)).toEqual([]);
  });
});
