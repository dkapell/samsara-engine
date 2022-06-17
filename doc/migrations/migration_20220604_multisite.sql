
create table games (
    id serial,
    name varchar(80) not null,
    description text,
    site varchar(255) unique,
    theme varchar(80),
    css text,
    created_by int,
    intercode_login boolean default false,
    default_to_player boolean default false,
    created timestamp with time zone DEFAULT now(),
    updated timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT games_created_fk FOREIGN KEY (created_by)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
);

create table game_users(
    user_id             int not null,
    game_id             int not null,
    type                user_type not null default 'none',
    created             timestamp with time zone DEFAULT now(),
    primary key(user_id, game_id),
    CONSTRAINT games_users_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT games_users_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

insert into game_users (user_id, game_id, type) select id, 1, type from users;

alter table users drop column type;
alter table users add column site_admin boolean default false;

create index games_site_idx ON games (site);

insert into games (name, created_by) values ('default', 1);

-- links
alter table links add column game_id int not null default 1;

alter table links add CONSTRAINT links_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

--codes
alter table codes add column game_id int not null default 1;

alter table codes add CONSTRAINT codes_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

alter table codes drop constraint codes_code_key;
alter table codes ADD UNIQUE (code, game_id);

-- runs
alter table runs add column game_id int not null default 1;

alter table runs add CONSTRAINT runs_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

alter table runs drop constraint runs_name_key;
alter table runs ADD UNIQUE (name, game_id);

-- groups
alter table groups add column game_id int not null default 1;

alter table groups add CONSTRAINT groups_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE IF EXISTS groups DROP CONSTRAINT IF EXISTS player_groups_name_key;
alter table groups ADD UNIQUE (code, game_id);

--images
alter table images add column game_id int not null default 1;

alter table images add CONSTRAINT images_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- screens
alter table screens add column game_id int not null default 1;

alter table screens add CONSTRAINT screens_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- transitions
alter table transitions add column game_id int not null default 1;

alter table transitions add CONSTRAINT transitions_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- triggers
alter table triggers add column game_id int not null default 1;

alter table triggers add CONSTRAINT triggers_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- players
alter table players add unique(user_id, run_id);
alter table players add column game_id int not null default 1;

alter table players add CONSTRAINT players_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- characters
alter table characters add column game_id int not null default 1;

alter table characters add CONSTRAINT characters_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- variables
alter table variables add column game_id int not null default 1;

alter table variables add CONSTRAINT variables_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE IF EXISTS variables DROP CONSTRAINT IF EXISTS variables_name_public_key;

ALTER TABLE IF EXISTS variables ADD UNIQUE (name, public, game_id);


-- documents
alter table documents add column game_id int not null default 1;

alter table documents add CONSTRAINT documents_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE IF EXISTS documents DROP CONSTRAINT IF EXISTS documents_name_key;

ALTER TABLE IF EXISTS documents ADD UNIQUE (name, game_id);

-- messages
alter table messages add column game_id int not null default 1;

alter table messages add CONSTRAINT messages_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- read_messages
alter table read_messages add column game_id int not null default 1;

alter table read_messages add CONSTRAINT read_messages_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- chat_reports
alter table chat_reports add column game_id int not null default 1;

alter table chat_reports add CONSTRAINT chat_reports_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- chat_blocks
alter table chat_blocks add column game_id int not null default 1;

alter table chat_blocks add CONSTRAINT chat_blocks_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- meetings
alter table meetings add column game_id int not null default 1;

alter table meetings add CONSTRAINT meetings_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- inks
alter table inks add column game_id int not null default 1;

alter table inks add CONSTRAINT inks_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- connections
alter table connections add column game_id int not null default 1;

alter table connections add CONSTRAINT connections_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

-- connections
alter table participants add column game_id int not null default 1;

alter table participants add CONSTRAINT participants_game_fk FOREIGN KEY (game_id)
    REFERENCES "games" (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE CASCADE;

