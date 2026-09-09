import useSWR from 'swr';
import { SepaStockRecord } from '../types/sepa';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface SepaTrendQueryParams {
  page?: number;
  limit?: number;
  filter?: string;
  min_rs?: number | null;
  search?: string;
  exclude_etf?: boolean;
  accelerating?: boolean;
  margin_expansion?: boolean;
  sweet_spot_cap?: boolean;
  min_liquidity?: boolean;
  min_sales_growth?: number | null;
  min_profit_growth?: number | null;
  min_eps_growth?: number | null;
  min_roe?: number | null;
  annual_growth?: boolean;
  strict_funda?: boolean;
  sort_by?: string | null;
  order?: 'asc' | 'desc';
}

export function useSepaTrend(params: SepaTrendQueryParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.filter) query.set('filter', params.filter);
  if (params.min_rs != null) query.set('min_rs', params.min_rs.toString());
  if (params.search) query.set('search', params.search);
  if (params.exclude_etf !== undefined) query.set('exclude_etf', params.exclude_etf ? 'true' : 'false');
  if (params.accelerating) query.set('accelerating', 'true');
  if (params.margin_expansion) query.set('margin_expansion', 'true');
  if (params.sweet_spot_cap) query.set('sweet_spot_cap', 'true');
  if (params.min_liquidity) query.set('min_liquidity', 'true');
  if (params.min_sales_growth != null) query.set('min_sales_growth', params.min_sales_growth.toString());
  if (params.min_profit_growth != null) query.set('min_profit_growth', params.min_profit_growth.toString());
  if (params.min_eps_growth != null) query.set('min_eps_growth', params.min_eps_growth.toString());
  if (params.min_roe != null) query.set('min_roe', params.min_roe.toString());
  if (params.annual_growth) query.set('annual_growth', 'true');
  if (params.strict_funda) query.set('strict_funda', 'true');
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.order) query.set('order', params.order);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/sepa/trend?${query.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  return {
    stocks: (data?.data || []) as SepaStockRecord[],
    total: (data?.total || 0) as number,
    page: (data?.page || 1) as number,
    totalPages: (data?.totalPages || 1) as number,
    isLoading,
    error,
    mutate
  };
}

export function useSepaVcp(
  mode: string = 'strict_funda',
  page: number = 1,
  limit: number = 50,
  sortBy?: string | null,
  order?: 'asc' | 'desc',
  excludeEtf: boolean = true,
  sweetSpotCap?: boolean,
  minLiquidity?: boolean
) {
  const query = new URLSearchParams({
    mode,
    page: page.toString(),
    limit: limit.toString(),
    exclude_etf: excludeEtf ? 'true' : 'false',
  });
  if (sweetSpotCap) query.set('sweet_spot_cap', 'true');
  if (minLiquidity) query.set('min_liquidity', 'true');
  if (sortBy) query.set('sort_by', sortBy);
  if (order) query.set('order', order);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/sepa/vcp-candidates?${query.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  return {
    candidates: (data?.data || []) as SepaStockRecord[],
    total: (data?.total || 0) as number,
    page: (data?.page || 1) as number,
    totalPages: (data?.totalPages || 1) as number,
    isLoading,
    error,
    mutate
  };
}

export function useSepaDiagnostics(ticker: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    ticker ? `/api/sepa/diagnostics/${ticker}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    diagnostics: data?.data as {
      metrics: SepaStockRecord;
      quotes: any[];
      irNews: any[];
      financials: any[];
    } | undefined,
    isLoading,
    error,
    mutate
  };
}
