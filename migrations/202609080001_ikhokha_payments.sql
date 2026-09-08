alter table public.orders alter column payment_provider set default 'ikhokha';
alter table public.orders alter column payment_method set default 'card';

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('paypal', 'card', 'eft', 'apple_pay', 'google_pay'));

comment on column public.orders.payfast_payment_id is
  'Legacy column used for the active payment provider transaction reference.';

update public.products set payment_link = null where payment_link ilike '%paypal.com%';
