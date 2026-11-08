import type { Page } from '@playwright/test';

export interface StorageSeed {
  local?: Record<string, string>;
  session?: Record<string, string>;
}

let nextSeedId = 1;

/**
 * Nạp localStorage/sessionStorage trước khi app chạy, đúng một lần cho mỗi tab.
 * Không dùng lại ở lần điều hướng sau, nếu không token vừa bị app xóa sẽ quay lại.
 */
export async function seedStorage(page: Page, seed: StorageSeed): Promise<void> {
  const marker = `pw.seeded.${nextSeedId++}`;
  await page.addInitScript(
    ({ marker: key, seed: values }) => {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        for (const [name, value] of Object.entries(values.local ?? {})) localStorage.setItem(name, value);
        for (const [name, value] of Object.entries(values.session ?? {})) sessionStorage.setItem(name, value);
      } catch {
        // about:blank không có storage.
      }
    },
    { marker, seed },
  );
}

export function readLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => localStorage.getItem(name), key);
}
