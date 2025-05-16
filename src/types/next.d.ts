declare module 'next/server' {
  export interface NextRequest extends Request {
    nextUrl: URL;
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string, options?: { path?: string; maxAge?: number }): void;
      delete(name: string): void;
      clear(): void;
    };
  }

  export const NextRequest: {
    new(input: RequestInfo | URL, init?: RequestInit): NextRequest;
    prototype: NextRequest;
  };

  export class NextResponse extends Response {
    public static json(body: any, init?: ResponseInit): NextResponse;
    public static redirect(url: string | URL, init?: ResponseInit): NextResponse;
    public static rewrite(destination: string | URL, init?: ResponseInit): NextResponse;
    public static next(init?: ResponseInit): NextResponse;
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string, options?: { path?: string; maxAge?: number }): void;
      delete(name: string): void;
      clear(): void;
    };
  }
}

declare module 'next/navigation' {
  export function useRouter(): {
    push(url: string): void;
    replace(url: string): void;
    refresh(): void;
    back(): void;
    forward(): void;
  };
  
  export function useParams<T extends Record<string, string | string[]>>(): T;
  export function useSearchParams(): {
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    forEach(callback: (value: string, key: string) => void): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
  };
  export function usePathname(): string;
}

declare module 'next/link' {
  import { ComponentType, LinkHTMLAttributes } from 'react';
  const Link: ComponentType<{
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  } & LinkHTMLAttributes<HTMLAnchorElement>>;
  export default Link;
}

declare module 'next/dynamic' {
  import { ComponentType, ReactNode } from 'react';
  export default function dynamic<P = {}>(
    dynamicOptions: () => Promise<ComponentType<P> | { default: ComponentType<P> }>,
    options?: {
      loading?: ComponentType<{ isLoading: boolean; error?: Error | null; pastDelay: boolean }>;
      ssr?: boolean;
      suspense?: boolean;
    }
  ): ComponentType<P>;
}

declare module 'next/font/google' {
  export interface FontOptions {
    weight?: string | string[];
    style?: string | string[];
    subsets?: string[];
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    preload?: boolean;
    variable?: string;
    adjustFontFallback?: boolean | string;
  }

  export function Inter(options?: FontOptions): {
    className: string;
    style: { fontFamily: string };
  };
}

declare module 'next/headers' {
  export function headers(): {
    get(name: string): string | null;
    has(name: string): boolean;
    forEach(callback: (value: string, key: string) => void): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
  };
  export function cookies(): {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
  };
}

declare module 'next' {
  import { IncomingMessage, ServerResponse } from 'http';
  import { NextConfig } from 'next/dist/server/config-shared';
  
  export interface NextApiRequest extends IncomingMessage {
    query: {
      [key: string]: string | string[] | undefined;
    };
    cookies: {
      [key: string]: string;
    };
    body: any;
  }
  
  export interface NextApiResponse<T = any> extends ServerResponse {
    status(statusCode: number): NextApiResponse<T>;
    json(data: T): void;
    send(data: T): void;
    redirect(statusOrUrl: string | number, url?: string): void;
    revalidate(urlPath: string): Promise<void>;
  }
  
  export type NextApiHandler<T = any> = (
    req: NextApiRequest,
    res: NextApiResponse<T>
  ) => void | Promise<void>;

  export type GetServerSidePropsContext = {
    req: IncomingMessage & { cookies: { [key: string]: string } };
    res: ServerResponse;
    params?: { [key: string]: string | string[] };
    query: { [key: string]: string | string[] };
    preview?: boolean;
    previewData?: any;
    resolvedUrl: string;
  };

  export type GetServerSidePropsResult<P> = {
    props: P;
  } | {
    redirect: {
      destination: string;
      permanent: boolean;
    };
  } | {
    notFound: true;
  };

  export type GetServerSideProps<
    P extends { [key: string]: any } = { [key: string]: any }
  > = (context: GetServerSidePropsContext) => Promise<GetServerSidePropsResult<P>>;

  export type Metadata = {
    title?: string;
    description?: string;
    [key: string]: any;
  };

  export default function Next(options: NextConfig): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

declare module '@mui/icons-material/ExpandMore' {
  import { ComponentType, SVGProps } from 'react';
  const ExpandMoreIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default ExpandMoreIcon;
}

declare module '@mui/icons-material/List' {
  import { ComponentType, SVGProps } from 'react';
  const ListIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default ListIcon;
}

declare module '@mui/icons-material/Storage' {
  import { ComponentType, SVGProps } from 'react';
  const StorageIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default StorageIcon;
}

declare module '@mui/icons-material/Assessment' {
  import { ComponentType, SVGProps } from 'react';
  const AssessmentIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default AssessmentIcon;
}

declare module '@mui/icons-material/AutoFixHigh' {
  import { ComponentType, SVGProps } from 'react';
  const AutoFixHighIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default AutoFixHighIcon;
}

declare module '@mui/icons-material/Memory' {
  import { ComponentType, SVGProps } from 'react';
  const MemoryIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default MemoryIcon;
}

declare module '@mui/icons-material/LiveHelp' {
  import { ComponentType, SVGProps } from 'react';
  const LiveHelpIcon: ComponentType<SVGProps<SVGSVGElement>>;
  export default LiveHelpIcon;
}

declare namespace JSX {
  interface IntrinsicElements {
    'style': React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement> & { jsx?: boolean }, HTMLStyleElement>;
  }
} 