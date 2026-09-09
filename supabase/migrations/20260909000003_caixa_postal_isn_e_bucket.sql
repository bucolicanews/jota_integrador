-- mensagens_caixa_postal não tinha nenhum campo pra identificar a mensagem na origem
-- (SERPRO) -- sem isso, sincronizar de novo duplicaria as mensagens (não tem como saber
-- "essa mensagem já existe"). `isn` é o identificador único do SERPRO pra cada mensagem
-- (confirmado testando de verdade contra o ambiente trial, serviço CAIXAPOSTAL/
-- MSGCONTRIBUINTE61 -- docs/BANCO_DE_DADOS.md §5).
alter table mensagens_caixa_postal add column serpro_isn text;

update mensagens_caixa_postal set serpro_isn = id::text where serpro_isn is null;

alter table mensagens_caixa_postal alter column serpro_isn set not null;

create unique index idx_mensagens_caixa_postal_empresa_isn on mensagens_caixa_postal(empresa_id, serpro_isn);

comment on column mensagens_caixa_postal.serpro_isn is 'Identificador da mensagem no SERPRO (campo "isn" do serviço MSGCONTRIBUINTE61/MSGDETALHAMENTO62) -- chave de dedup pra sincronização não duplicar mensagem já importada.';

-- protege_campos_mensagem_caixa_postal (migration 0006) só protege os campos
-- explicitamente listados -- serpro_isn precisa entrar na mesma proteção (nunca editável
-- por quem não é plataforma, senão um usuário poderia forjar isn e colidir com outra
-- mensagem/burlar a dedup).
create or replace function protege_campos_mensagem_caixa_postal()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.orgao is distinct from old.orgao
       or new.assunto is distinct from old.assunto
       or new.data_recebimento is distinct from old.data_recebimento
       or new.conteudo_ref is distinct from old.conteudo_ref
       or new.empresa_id is distinct from old.empresa_id
       or new.serpro_isn is distinct from old.serpro_isn
    then
      raise exception 'Só o status (lida/não lida) pode ser alterado pelo usuário final';
    end if;
  end if;
  return new;
end;
$$;

-- Bucket privado pro conteúdo (corpoModelo, já com as variáveis substituídas) das
-- mensagens -- mesmo raciocínio de "referência, não a coisa inteira na tabela" já usado
-- pros certificados, mas SEM cifragem (classificação LGPD "Restrito", não "Crítico" --
-- docs/SEGURANCA.md §5): controle de acesso via RLS/bucket privado já é a proteção
-- adequada pra esse nível, cifragem seria trabalho redundante.
insert into storage.buckets (id, name, public)
values ('mensagens-caixa-postal', 'mensagens-caixa-postal', false)
on conflict (id) do nothing;
