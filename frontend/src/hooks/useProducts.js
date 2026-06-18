/** React Query hooks for products. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService } from '@/services/products.service';
import { queryKeys } from '@/lib/queryKeys';

/** @param {import('@/types').ProductListParams} [params] */
export function useProducts(params) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productsService.getAll(params),
  });
}

export function useProduct(id) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useProductKpis() {
  return useQuery({
    queryKey: queryKeys.products.kpis,
    queryFn: () => productsService.getKpis(),
  });
}

function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.products.all });
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (payload) => productsService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, payload }) => productsService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id) => productsService.remove(id),
    onSuccess: invalidate,
  });
}

export function useAdjustStock() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, adjustment }) => productsService.adjustStock(id, adjustment),
    onSuccess: invalidate,
  });
}
