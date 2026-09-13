# OceanEmbed Intelligence & About Us — Required npm Dependencies

The following packages are required to run the copied **Intelligence** and **About Us** modules.

## 1. Runtime Dependencies

| Package | Version | Required By | Purpose |
|---|---|---|---|
| `d3-geo` | `^3.1.1` | `components/intelligence/OceanLocationMap.jsx` | Performs Equirectangular map projection, GeoJSON path rendering, coordinate inversion, and land polygon containment checking (`geoContains`). |
| `@emailjs/browser` | `^4.4.1` | `app/about-us/page.tsx` | Submits the contact form on the About Us page to EmailJS API. |
| `next` | `15.1.6` | App Router & Navigation | Framework runtime for React Server/Client Components, `<Link>`, `<Image>`, `usePathname`, and `next.config.ts` redirects. |
| `react` | `^19.0.0` | Global | Core UI framework. |
| `react-dom` | `^19.0.0` | Global | React DOM rendering engine. |

## 2. Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `^5` | Type-checking for `.ts` and `.tsx` files (`page.tsx`, `RealSSTDataProvider.ts`, `next.config.ts`). |
| `@types/node` | `^20` | Node.js type definitions. |
| `@types/react` | `^19` | React type definitions. |
| `@types/react-dom` | `^19` | React DOM type definitions. |

---

### Installation Command

Run this command inside the target Next.js application directory:

```bash
npm install d3-geo @emailjs/browser
```
