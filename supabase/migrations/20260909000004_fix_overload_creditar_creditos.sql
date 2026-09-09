-- Bug real descoberto testando de ponta a ponta (caixa_postal/, sincronização caindo em
-- EstornarCreditosUseCase): a migration 20260909000002 fez `CREATE OR REPLACE FUNCTION
-- creditar_creditos(..., p_tipo_operacao text DEFAULT ...)` esperando que substituísse a
-- função original de 3 parâmetros -- mas no Postgres, `CREATE OR REPLACE` só troca uma
-- função com a MESMA assinatura (nome + tipos dos parâmetros). Acrescentar um parâmetro,
-- mesmo com DEFAULT, cria uma SOBRECARGA NOVA ao lado da antiga, não substitui.
--
-- Resultado: qualquer chamada via RPC do Supabase (que sempre usa parâmetros nomeados)
-- passando só os 3 parâmetros originais ficou AMBÍGUA entre as duas sobrecargas --
-- Postgres não consegue decidir qual delas o chamador quis (a de 3 parâmetros exata, ou
-- a de 4 com o último defaultado) e recusa a chamada com
-- "Could not choose the best candidate function". Isso já estava dormente desde a
-- migration anterior -- só apareceu agora porque EstornarCreditosUseCase (chamado pela
-- primeira vez depois daquela migration, no fluxo de estorno do caixa_postal) chama
-- `creditar()` sem o 4º argumento.
--
-- Corrigido removendo explicitamente a sobrecarga antiga -- só a versão de 4 parâmetros
-- (com DEFAULT) fica, então toda chamada existente sem o 4º argumento continua
-- funcionando exatamente igual, sem ambiguidade.
drop function if exists creditar_creditos(uuid, integer, text);

comment on function creditar_creditos(uuid, integer, text, text) is 'Crédito/ajuste atômico -- cria o registro de saldo na primeira concessão se ainda não existir. tipo_operacao default AJUSTE_MANUAL (admin); assinaturas/ usa RENOVACAO_ASSINATURA. Única versão desta função -- ver migration 20260909000004 pro motivo de não haver mais uma sobrecarga de 3 parâmetros.';
