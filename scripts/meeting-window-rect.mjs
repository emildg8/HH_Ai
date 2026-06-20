#!/usr/bin/env node
/**
 * Поиск окна Zoom / Телемост / Teams на Windows → JSON { x, y, w, h, title }.
 * stdout: {} если не найдено.
 */

import { spawnSync } from 'child_process';

const MEETING_RE =
  /zoom meeting|zoom workplace|телемост|yandex telemost|microsoft teams|google meet|собеседование/i;

function psScript() {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinRect {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string Find() {
    var best = IntPtr.Zero;
    var bestArea = 0;
    var bestTitle = "";
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(hWnd, sb, 512);
      var title = sb.ToString();
      if (string.IsNullOrWhiteSpace(title)) return true;
      RECT r;
      if (!GetWindowRect(hWnd, out r)) return true;
      var w = r.Right - r.Left;
      var h = r.Bottom - r.Top;
      if (w < 400 || h < 300) return true;
      var t = title.ToLowerInvariant();
      if (!(t.Contains("zoom") || t.Contains("телемост") || t.Contains("telemost") || t.Contains("teams") || t.Contains("meet") || t.Contains("собес"))) return true;
      var area = w * h;
      if (area > bestArea) { bestArea = area; best = hWnd; bestTitle = title; }
      return true;
    }, IntPtr.Zero);
    if (best == IntPtr.Zero) return "{}";
    RECT br;
    GetWindowRect(best, out br);
    return "{\\"x\\":" + br.Left + ",\\"y\\":" + br.Top + ",\\"w\\":" + (br.Right-br.Left) + ",\\"h\\":" + (br.Bottom-br.Top) + ",\\"title\\":\\"" + bestTitle.Replace("\\\\","\\\\\\\\").Replace("\\"","\\\\\\"") + "\\"}";
  }
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
}
"@
[WinRect]::Find()
`.trim();
}

function findOnWindows() {
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', psScript()],
    { encoding: 'utf8', windowsHide: true }
  );
  const out = (r.stdout || '').trim();
  if (!out || out === '{}') return null;
  try {
    const parsed = JSON.parse(out);
    if (parsed?.w > 0 && parsed?.h > 0) return parsed;
  } catch {
    /* */
  }
  return null;
}

function findFallback() {
  if (process.platform !== 'win32') return null;
  return findOnWindows();
}

const rect = findFallback();
if (rect && rect.title && !MEETING_RE.test(rect.title)) {
  // still usable if zoom/telemost keyword in title from PS filter
}
process.stdout.write(rect ? `${JSON.stringify(rect)}\n` : '{}\n');
