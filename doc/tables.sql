CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create type user_type as ENUM(
    'admin',
    'creator',
    'gm',
    'player',
    'none'
);

create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id   varchar(500),
    intercode_id varchar(500),
    type        user_type default none,
    PRIMARY KEY (id)
);

create table links (
    id          serial,
    name        varchar(80) not null,
    description text,
    url         varchar(255) not null,
    gm          varchar(255),
    active      boolean default true,
    primary key (id)
);

create table codes (
    id serial,
    code varchar(20) unique,
    description text,
    actions jsonb default '[]'::jsonb,
    primary key(id)
);

create table runs (
    id          serial,
    name        varchar(80) not null unique,
    current     boolean default false,
    show_stubs  boolean default true,
    data jsonb,
    primary key(id)
);

create table groups (
    id          serial,
    name        varchar(80) not null unique,
    description text,
    chat        boolean default false,
    primary key (id),
);

create table images (
    id  serial,
    name varchar(255) not null,
    display_name varchar(255),
    is_gamestate boolean default true,
    is_popup boolean default false,
    is_inventory boolean default false,
    type image_type not null default 'gamestate',
    description text,
    status varchar(20) default 'new' not null,
    primary key (id)
);

create table gamestates (
    id serial,
    name varchar(255) not null,
    description text,
    special     boolean default false,
    start       boolean default false,
    finish      boolean default false,
    image_id    int not null,
    map         jsonb default '[]'::jsonb,
    template    boolean default false,
    chat        boolean default false,
    show_count  boolean default false,
    show_name   boolean default false,
    primary key (id),
    CONSTRAINT gamestate_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
);

insert into gamestates (name, start) values ('Initial', true);

create table gamestate_codes(
    gamestate_id int not null,
    code_id int not null,
    primary key (gamestate_id, code_id),
    CONSTRAINT gsc_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT gsc_code_fk FOREIGN KEY (code_id)
        REFERENCES "codes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table transitions(
    id serial,
    from_state_id int not null,
    to_state_id int not null,
    group_id int,
    delay int default 0,
    primary key(id),
    CONSTRAINT transitions_from_fk FOREIGN KEY (from_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_to_fk FOREIGN KEY (to_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
     CONSTRAINT transitions_link_fk FOREIGN KEY (link_id)
        REFERENCES "links" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table triggers(
    id serial,
    name varchar(255),
    description text,
    icon varchar(20),
    actions jsonb default '[]'::jsonb,
    run boolean default false,
    player boolean default false,
    primary key (id)
);

create table players (
    id          serial,
    user_id     int,
    run_id      int,
    character   varchar(255),
    gamestate_id int,
    prev_gamestate_id int,
    character_sheet varchar(255),
    statetime timestamp with time zone DEFAULT now(),
    data jsonb,
    primary key (id),
    CONSTRAINT players_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_run_fk FOREIGN KEY (run_id)
        REFERENCES "runs" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT players_prev_gamestate_fk FOREIGN KEY (prev_gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
);

create table player_groups(
    player_id int not null,
    group_id int not null,
    CONSTRAINT player_fk FOREIGN KEY (player_id)
        REFERENCES "players" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
)

create type variable_type as ENUM(
    'integer',
    'string',
    'date',
    'boolean',
    'object',
    'array'
);

create table variables(
    id serial,
    name varchar(255) not null,
    type variable_type not null,
    player boolean default true,
    public boolean default false,
    base_value text,
    primary key (id),
    unique(name, public)
);

create table documents(
    id serial,
    name varchar(255) not null unique,
    code uuid not null default uuid_generate_v4(),
    description text,
    content text,
    primary key (id)
);

create type message_location as ENUM(
    'gamestate',
    'group',
    'gm',
    'direct',
    'report'
);

create table messages(
    id serial,
    message_id uuid not null unique,
    run_id int,
    user_id int not null,
    location message_location not null,
    location_id int,
    content text not null,
    removed boolean default false,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT messages_run_fk FOREIGN KEY (run_id)
        REFERENCES "runs" (id) match simple
        ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT messages_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) match simple
        ON UPDATE NO ACTION ON DELETE NO ACTION
);

create table read_messages(
    user_id int not null,
    location message_location not null,
    message_id uuid not null,
    seen timestamp with time zone DEFAULT now(),
    emailed boolean default false,
    primary key (user_id, location),
    constraint read_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table chat_blocks(
    id serial,
    user_id int not null,
    blocked_user_id int not null,
    created timestamp with time zone default now(),
    constraint chat_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE,
    constraint chat_blocked_user_fl foreign key (blocked_user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table chat_reports(
    id serial,
    user_id int not null,
    report_id uuid not null unique default uuid_generate_v4(),
    message_id uuid not null,
    reason text,
    created timestamp with time zone default now(),
    resolved timestamp with time zone,
    resolution varchar(80),
    resolved_by int,
    constraint chat_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE,
     constraint chat_message_fk foreign key (message_id)
        REFERENCES "messages" (message_id) match simple
        on update no action on delete CASCADE,
    constraint chat_resolver_fk foreign key (resolved_by)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table connections(
    id serial,
    user_id int not null,
    server_id varchar(255),
    created timestamp with time zone default now(),
    constraint connection_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);
