import useSWR from 'swr';
import { SepaStockRecord } from '../types/sepa';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface SepaTrendQueryParams {
  page?: number;
  limit?: number;
  filter?: string;
  min_rs?: number | null;
  search?: string;
  accelerating?: boolean;
  margin_expansion?: boolean;
  sweet_spot_cap?: boolean;
  min_liquidity?: boolean;
}

export function useSepaTrend(params: SepaTrendQueryParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.filter) query.set('filter', params.filter);
  if (params.min_rs != null) query.set('min_rs', params.min_rs.toString());
  if (params.search) query.set('search', params.search);
  if (params.accelerating) query.set('accelerating', 'true');
  if (params.margin_expansion) query.set('margin_expansion', 'true');
  if (params.sweet_spot_cap) query.set('sweet_spot_cap', 'true');
  if (params.min_liquidity) query.set('min_liquidity', 'true');

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

export function useSepaVcp(mode: string = 'near_pivot', page: number = 1, limit: number = 50) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/sepa/vcp-candidates?mode=${mode}&page=${page}&limit=${limit}`,
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
