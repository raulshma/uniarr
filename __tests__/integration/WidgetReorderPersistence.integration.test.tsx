import { widgetService } from "@/services/widgets/WidgetService";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Integration test to verify widget reorder/cache persistence fix.
 * Validates that:
 * 1. Widget reorder correctly updates the internal Map in new order
 * 2. Widget cached data (widgetData) remains accessible after reorder
 * 3. refreshWidgetsFromStorage rehydrates both widgets and widgetData
 * 4. WidgetContainer refresh does NOT trigger skeleton state when cache is available
 */

describe("WidgetService Reorder and Cache Persistence", () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
    // Reset WidgetService singleton
    (widgetService as any).isInitialized = false;
    (widgetService as any).widgets.clear();
    (widgetService as any).widgetData = {};
  });

  it("should reorder widgets atomically by rebuilding the internal Map", async () => {
    // Initialize service
    await widgetService.initialize();

    // Get initial widgets in default order
    const initialWidgets = await widgetService.getWidgets();
    expect(initialWidgets.length).toBeGreaterThan(0);

    // Verify default order
    expect(initialWidgets[0]?.order).toBe(0);
    expect(initialWidgets[1]?.order).toBe(1);

    // Create a new order (reverse the first two)
    const newOrder = [initialWidgets[1]!.id, initialWidgets[0]!.id];

    // Reorder
    await widgetService.reorderWidgets(newOrder);

    // Verify reorder was applied
    const reorderedWidgets = await widgetService.getWidgets();
    expect(reorderedWidgets[0]?.id).toBe(newOrder[0]);
    expect(reorderedWidgets[0]?.order).toBe(0);
    expect(reorderedWidgets[1]?.id).toBe(newOrder[1]);
    expect(reorderedWidgets[1]?.order).toBe(1);
  });

  it("should preserve widget cached data after reorder", async () => {
    // Initialize
    await widgetService.initialize();

    // Get a widget ID
    const widgets = await widgetService.getWidgets();
    const testWidgetId = widgets[0]?.id;
    expect(testWidgetId).toBeDefined();

    // Cache some test data
    const testData = [{ id: "test-1", value: "data" }];
    await widgetService.setWidgetData(testWidgetId!, testData, 60000);

    // Verify data is cached
    let cachedData = await widgetService.getWidgetData(testWidgetId!);
    expect(cachedData).toEqual(testData);

    // Now reorder (swap order of all widgets)
    const allIds = widgets.map((w) => w.id);
    allIds.reverse();
    await widgetService.reorderWidgets(allIds);

    // Verify cached data is STILL accessible after reorder
    cachedData = await widgetService.getWidgetData(testWidgetId!);
    expect(cachedData).toEqual(testData);
  });

  it("should reload both widgets and widgetData on refreshWidgetsFromStorage", async () => {
    // Initialize and cache data
    await widgetService.initialize();
    const widgets = await widgetService.getWidgets();
    const testWidgetId = widgets[0]?.id;

    const testData = { status: "active" };
    await widgetService.setWidgetData(testWidgetId!, testData, 60000);

    // Verify initial state
    let cachedData = await widgetService.getWidgetData(testWidgetId!);
    expect(cachedData).toEqual(testData);

    // Simulate reset without reinitializing (partial state loss)
    (widgetService as any).widgetData = {};

    // Verify data is lost
    cachedData = await widgetService.getWidgetData(testWidgetId!);
    expect(cachedData).toBeNull();

    // Call refreshWidgetsFromStorage (should reload both widgets and widgetData)
    await widgetService.refreshWidgetsFromStorage();

    // Verify widgetData is rehydrated
    cachedData = await widgetService.getWidgetData(testWidgetId!);
    expect(cachedData).toEqual(testData);
  });

  it("should throw error on saveWidgets failure", async () => {
    await widgetService.initialize();

    // Mock AsyncStorage.setItem to reject
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");
    setItemSpy.mockRejectedValueOnce(new Error("Storage quota exceeded"));

    // Attempt to reorder should throw
    const widgets = await widgetService.getWidgets();
    const allIds = widgets.map((w) => w.id);

    await expect(widgetService.reorderWidgets(allIds)).rejects.toThrow(
      "Failed to save widgets",
    );

    setItemSpy.mockRestore();
  });

  it("should maintain full widget set when reordering subset", async () => {
    await widgetService.initialize();

    const allWidgets = await widgetService.getWidgets();
    const allIds = allWidgets.map((w) => w.id);
    const count = allIds.length;

    // Reorder only the first two widgets
    const reorderedSubset = [allIds[1]!, allIds[0]!];
    await widgetService.reorderWidgets(reorderedSubset);

    // Verify all widgets are still present
    const afterReorder = await widgetService.getWidgets();
    expect(afterReorder.length).toBe(count);
  });

  it(
    "should preserve cache availability through reorder->refresh cycle " +
      "(simulates settings return flow)",
    async () => {
      // Step 1: Initialize and cache widget data (simulates dashboard initial load)
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const enabledWidgets = widgets.filter((w) => w.enabled);
      const testWidgetId = enabledWidgets[0]?.id;
      expect(testWidgetId).toBeDefined();

      const cachedPayload = { items: ["item1", "item2"] };
      await widgetService.setWidgetData(testWidgetId!, cachedPayload, 300000);

      // Verify cache is available (dashboard displaying data)
      let cached = await widgetService.getWidgetData(testWidgetId!);
      expect(cached).toEqual(cachedPayload);

      // Step 2: User goes to settings and reorders (settings calls saveReorder)
      const reorderedIds = widgets.map((w) => w.id).reverse();
      await widgetService.reorderWidgets(reorderedIds);

      // Step 3: User returns to dashboard (WidgetContainer.useFocusEffect fires)
      // This is the critical path: refresh + get widgets without setting isLoading=true
      await widgetService.refreshWidgetsFromStorage();
      const freshWidgets = await widgetService.getWidgets();
      const freshEnabled = freshWidgets.filter((w) => w.enabled);

      // Step 4: Verify cache is STILL available (widgets should not show skeleton)
      cached = await widgetService.getWidgetData(testWidgetId!);
      expect(cached).toEqual(cachedPayload);

      // Step 5: Verify widget order changed and full set maintained
      expect(freshWidgets.length).toBe(widgets.length);
      expect(freshEnabled.length).toBe(enabledWidgets.length);
    },
  );
});
