export type User = {
  id: string;
  email: string;
};

export type Supplier = {
  id: string;
  nome: string;
  cnpj: string;
  endereco?: string;
  telefone?: string;
  email?: string;
};

export type Invoice = {
  id: string;
  user_id: string;
  fornecedor: string;
  cnpj: string;
  vencimento: string; // ISO date
  total: number;
  arquivo_url: string;
  parcela?: number; // índice da parcela (1,2,3...)
};

export type Product = {
  id: string;
  invoice_id: string;
  nome: string;
  data_compra: string; // ISO date
  valor_unitario: number;
};