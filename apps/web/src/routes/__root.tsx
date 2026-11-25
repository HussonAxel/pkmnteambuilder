import type { AppRouter } from "@pkmnteambuilder/api/routers/index";
import { Toaster } from "@pkmnteambuilder/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createMiddleware } from "@tanstack/react-start";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { evlogErrorHandler } from "evlog/nitro/v3";

import Footer from "../components/footer";
import Header from "../components/header";
import { I18nProvider, readLang } from "../lib/i18n";
import { EraSpritesProvider } from "../lib/sprites";
import { TeamsProvider } from "../lib/teams";
import { readTheme } from "../lib/theme";

import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // Cookie on the server, document.cookie in the browser: no round-trip on client navigation.
  beforeLoad: () => ({ lang: readLang(), theme: readTheme() }),
  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },

  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "pkmnteambuilder",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const { lang, theme } = Route.useRouteContext();
  return (
    <html lang={lang} className={theme === "dark" ? "dark" : undefined}>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider initial={lang}>
          <TeamsProvider>
            <EraSpritesProvider>
              {/* min-h, not h: the footer sits below the page, not over it. */}
              <div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
                <Header />
                <Outlet />
                <Footer />
              </div>
            </EraSpritesProvider>
          </TeamsProvider>
        </I18nProvider>
        <Toaster richColors theme={theme} />
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
