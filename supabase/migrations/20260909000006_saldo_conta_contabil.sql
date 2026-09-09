-- Saldo de uma conta contábil, calculado sempre na hora (SUM sobre lancamentos_partidas)
-- em vez de mantido em tabela de cache separada -- decisão deliberada: o jotaCaixa tinha
-- uma tabela `saldo_contas` cacheada e ela é uma das causas prováveis do incidente de
-- balanço não fechar (saldo cacheado podendo divergir da soma real dos lançamentos).
-- Se performance virar problema real com volume alto, adicionar materialização depois
-- -- não preventivamente agora (YAGNI).
--
-- Estornos NÃO são filtrados daqui de propósito: um lançamento estornado continua com
-- suas partidas originais na soma, e o lançamento de estorno (débito/crédito invertidos)
-- soma junto -- os dois se cancelam matematicamente, é o comportamento contábil correto
-- (rastro completo preservado, nunca "como se não tivesse acontecido").
create or replace function saldo_conta_contabil(p_conta_id uuid, p_ate_data date default null)
returns numeric
language sql
stable
as $$
  -- coalesce no nível mais externo -- sem partidas (ou nenhuma antes de p_ate_data), a
  -- subquery abaixo não retorna nenhuma linha, e uma function de linguagem `sql` retorna
  -- NULL nesse caso; queremos 0, não NULL, pra conta sem movimento ainda.
  select coalesce(
    (
      select
        case
          when pc.grupo in ('ativo', 'custo')
            then sum(case when lp.tipo = 'debito' then lp.valor else -lp.valor end)
          else
            sum(case when lp.tipo = 'credito' then lp.valor else -lp.valor end)
        end
      from plano_contas pc
      join lancamentos_partidas lp on lp.conta_id = pc.id
      join lancamentos_contabeis lc on lc.id = lp.lancamento_id
      where pc.id = p_conta_id
        and (p_ate_data is null or lc.data_competencia <= p_ate_data)
      group by pc.grupo
    ),
    0
  )
$$;

comment on function saldo_conta_contabil(uuid, date) is 'Saldo assinado (positivo = a favor da natureza da conta) somando todas as partidas até a data informada (ou até hoje, se omitida). Sempre calculado na hora, nunca cacheado.';
