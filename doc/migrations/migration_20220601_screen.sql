alter table gamestates rename to screens;
alter table screens rename constraint gamestate_image_fk to screen_image_fk;

alter table gamestate_codes rename to screen_codes;
alter table screen_codes rename column gamestate_id to screen_id;
alter table screen_codes rename constraint gsc_gamestate_fk to sc_screen_fk;
alter table screen_codes rename constraint gsc_code_fk to sc_code_fk;

alter table transitions rename column from_state_id to from_screen_id;
alter table transitions rename column to_state_id to to_screen_id;

alter table players rename column gamestate_id to screen_id;
alter table players rename column prev_gamestate_id to prev_screen_id;
alter table players rename constraint players_gamestate_fk to players_screen_fk;
alter table players rename constraint players_prev_gamestate_fk  to players_prev_screen_fk;

alter table meetings rename column gamestate_id to screen_id;

alter table meetings rename constraint meeting_gamestate_fk to meeting_screen_fk;

alter table images rename column is_gamestate to is_screen;

drop type image_type;

ALTER TYPE message_location RENAME VALUE 'gamestate' TO 'screen';
