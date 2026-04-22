import { serviceHealthMonitor } from "@/services/notifications/ServiceHealthMonitor";
import { notificationEventService } from "@/services/notifications/NotificationEventService";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useSettingsStore } from "@/store/settingsStore";
import { logger } from "@/services/logger/LoggerService";

jest.mock("@/services/notifications/NotificationEventService", () => ({
  notificationEventService: {
    notifyServiceStatusChange: jest.fn(),
  },
}));

jest.mock("@/connectors/manager/ConnectorManager", () => {
  const manager = {
    loadSavedServices: jest.fn(),
    getAllConnectors: jest.fn(),
  };

  return {
    __manager: manager,
    ConnectorManager: {
      getInstance: jest.fn(() => manager),
    },
  };
});

jest.mock("@/store/settingsStore", () => ({
  useSettingsStore: {
    getState: jest.fn(),
  },
}));

jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    error: jest.fn(),
  },
}));

const mockNotifyServiceStatusChange =
  notificationEventService.notifyServiceStatusChange as jest.Mock;
const mockedConnectorManagerModule = jest.requireMock(
  "@/connectors/manager/ConnectorManager",
) as {
  __manager: {
    loadSavedServices: jest.Mock;
    getAllConnectors: jest.Mock;
  };
};
const mockLoadSavedServices =
  mockedConnectorManagerModule.__manager.loadSavedServices;
const mockGetAllConnectors =
  mockedConnectorManagerModule.__manager.getAllConnectors;
const mockGetSettingsState = useSettingsStore.getState as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

type ServiceHealthStatus = "healthy" | "degraded" | "offline";

const buildHealth = (status: ServiceHealthStatus, message?: string) => ({
  status,
  message,
  lastChecked: new Date(),
});

const resetMonitorState = (): void => {
  const monitor = serviceHealthMonitor as any;
  monitor.stop();
  monitor.lastStatuses.clear();
  monitor.isChecking = false;
  monitor.hasBootstrapped = false;
  monitor.hasCompletedInitialCheck = false;
  monitor.isRunning = false;
  monitor.timer = null;
};

describe("ServiceHealthMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMonitorState();

    mockGetSettingsState.mockReturnValue({
      notificationsEnabled: true,
      serviceHealthNotificationsEnabled: true,
    });
    mockLoadSavedServices.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetMonitorState();
  });

  it("does not notify on the initial health check pass", async () => {
    const connector = {
      config: { id: "svc-1", name: "Sonarr", type: "sonarr" },
      getHealth: jest
        .fn()
        .mockResolvedValue(buildHealth("offline", "Service unreachable")),
    } as any;

    mockGetAllConnectors.mockReturnValue([connector]);

    await (serviceHealthMonitor as any).runCheck();

    expect(mockLoadSavedServices).toHaveBeenCalledTimes(1);
    expect(mockNotifyServiceStatusChange).not.toHaveBeenCalled();
    expect((serviceHealthMonitor as any).lastStatuses.get("svc-1")).toBe(
      "offline",
    );
  });

  it("notifies on status changes after initial baseline", async () => {
    const connector = {
      config: { id: "svc-1", name: "Sonarr", type: "sonarr" },
      getHealth: jest
        .fn()
        .mockResolvedValueOnce(buildHealth("offline", "Service unreachable"))
        .mockResolvedValueOnce(buildHealth("healthy")),
    } as any;

    mockGetAllConnectors.mockReturnValue([connector]);

    await (serviceHealthMonitor as any).runCheck();
    await (serviceHealthMonitor as any).runCheck();

    expect(mockNotifyServiceStatusChange).toHaveBeenCalledTimes(1);
    expect(mockNotifyServiceStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "svc-1",
        serviceName: "Sonarr",
        previousStatus: "offline",
        health: expect.objectContaining({ status: "healthy" }),
      }),
    );
  });

  it("keeps suppression until at least one connector is checked", async () => {
    const connector = {
      config: { id: "svc-1", name: "Sonarr", type: "sonarr" },
      getHealth: jest
        .fn()
        .mockResolvedValue(buildHealth("offline", "Service unreachable")),
    } as any;

    mockGetAllConnectors
      .mockReturnValueOnce([])
      .mockReturnValueOnce([connector]);

    await (serviceHealthMonitor as any).runCheck();
    await (serviceHealthMonitor as any).runCheck();

    expect(mockNotifyServiceStatusChange).not.toHaveBeenCalled();
    expect((serviceHealthMonitor as any).hasCompletedInitialCheck).toBe(true);
  });
});
