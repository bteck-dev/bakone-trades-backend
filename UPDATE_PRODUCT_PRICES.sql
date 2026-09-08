begin;

update public.products
set price = case slug
  when 'poverty-scalper-ea' then 30.00
  when 'fx-killer-pv4-pro' then 21.00
end
where slug in ('poverty-scalper-ea', 'fx-killer-pv4-pro');

commit;

select name, slug, price
from public.products
where slug in ('poverty-scalper-ea', 'fx-killer-pv4-pro')
order by slug;
