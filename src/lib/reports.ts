import { Report } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

async function ensureDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

export async function saveReport(report: Report): Promise<void> {
  await ensureDir();
  const filePath = path.join(REPORTS_DIR, `${report.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
}

export async function getReport(id: string): Promise<Report | null> {
  try {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function listReports(): Promise<{ id: string; personName: string; createdAt: string }[]> {
  await ensureDir();
  const files = await fs.readdir(REPORTS_DIR);
  const reports: { id: string; personName: string; createdAt: string }[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf-8');
      const report: Report = JSON.parse(content);
      reports.push({
        id: report.id,
        personName: report.personName,
        createdAt: report.createdAt,
      });
    } catch {
      // Skip malformed files
    }
  }

  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteReport(id: string): Promise<boolean> {
  try {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
