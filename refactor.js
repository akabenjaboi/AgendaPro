import fs from 'fs';
import path from 'path';

const map = {
  // Backgrounds
  'bg-slate-900': 'bg-slate-50',
  'bg-slate-900/': 'bg-slate-100/',
  'bg-slate-800': 'bg-white',
  'bg-slate-800/': 'bg-slate-50/',
  'bg-slate-700': 'bg-slate-100',
  'bg-slate-700/': 'bg-slate-200/',
  
  // Text
  'text-slate-100': 'text-slate-900',
  'text-slate-200': 'text-slate-800',
  'text-slate-300': 'text-slate-700',
  'text-slate-400': 'text-slate-600',
  
  // Borders
  'border-slate-700': 'border-slate-200',
  'border-slate-700/': 'border-slate-200/',
  'border-slate-600': 'border-slate-300',
  
  // Brand interactions (hover states etc)
  'hover:text-slate-100': 'hover:text-slate-900',
  'hover:bg-slate-700': 'hover:bg-slate-100',
  'hover:bg-slate-600': 'hover:bg-slate-200'
};

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [from, to] of Object.entries(map)) {
        // Simple global replace
        const regex = new RegExp(from.replace(/\//g, '\\/'), 'g');
        if (regex.test(content)) {
          content = content.replace(regex, to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

walk(path.join(process.cwd(), 'client/src'));
console.log('Done!');
