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
    type        user_type default 'none',
    PRIMARY KEY (id)
);

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
    google_client_id varchar(80),
    google_client_secret varchar(80),
    primary key (id),
    CONSTRAINT games_created_fk FOREIGN KEY (created_by)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
)

create index games_site_idx ON games (site);

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
)

create table links (
    id          serial,
    game_id     int not null,
    name        varchar(80) not null,
    description text,
    url         varchar(255) not null,
    gm          varchar(255),
    active      boolean default true,
    primary key (id),
    CONSTRAINT links_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table codes (
    id serial,
    game_id    int not null,
    code varchar(20),
    description text,
    actions jsonb default '[]'::jsonb,
    primary key(id),
    unique(code, game_id),
    CONSTRAINT codes_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table runs (
    id          serial,
    game_id     int not null,
    name        varchar(80) not null,
    current     boolean default false,
    show_stubs  boolean default true,
    data jsonb,
    primary key(id),
    unique(game_id, name),
    CONSTRAINT runs_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

insert into runs (name, current) values ('Initial Run', 'true');

create table groups (
    id          serial,
    game_id     int not null,
    name        varchar(80) not null,
    description text,
    chat        boolean default false,
    unique      (game_id, name),
    primary key (id),
    CONSTRAINT groups_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table images (
    id              serial,
    game_id         int not null,
    name            varchar(255) not null,
    display_name    varchar(255),
    is_screen       boolean default true,
    is_popup        boolean default false,
    is_inventory    boolean default false,
    description     text,
    status          varchar(20) default 'new' not null,
    primary key (id),
    CONSTRAINT images_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table screens (
    id serial,
    game_id     int not null,
    name        varchar(255) not null,
    description text,
    special     boolean default false,
    start       boolean default false,
    finish      boolean default false,
    image_id    int,
    map         jsonb default '[]'::jsonb,
    template    boolean default false,
    chat        boolean default false,
    show_count  boolean default false,
    show_name   boolean default false,
    primary key (id),
    CONSTRAINT screen_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT screens_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

insert into screens (name, start) values ('Initial', true);

create table screen_codes(
    screen_id int not null,
    code_id int not null,
    primary key (screen_id, code_id),
    CONSTRAINT sc_screen_fk FOREIGN KEY (screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT sc_code_fk FOREIGN KEY (code_id)
        REFERENCES "codes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table transitions(
    id serial,
    game_id int not null,
    from_screen_id int not null,
    to_screen_id int not null,
    group_id int,
    delay int default 0,
    primary key(id),
    CONSTRAINT transitions_from_fk FOREIGN KEY (from_screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_to_fk FOREIGN KEY (to_screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT transitions_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table triggers(
    id serial,
    game_id int not null,
    name varchar(255),
    description text,
    icon varchar(20),
    actions jsonb default '[]'::jsonb,
    run boolean default false,
    player boolean default false,
    group_id int,
    condition text
    primary key (id),
    CONSTRAINT triggers_group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT triggers_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table players (
    id          serial,
    user_id     int,
    game_id     int not null,
    run_id      int,
    character   varchar(255),
    screen_id int,
    prev_screen_id int,
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
    CONSTRAINT players_screen_fk FOREIGN KEY (screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT players_prev_screen_fk FOREIGN KEY (prev_screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    unique(user_id, run_id)
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
);

create table characters (
    id              serial,
    game_id         int not null
    name            varchar(255),
    character_sheet varchar(255),
    description     text,
    data            jsonb,
    primary key (id),
    CONSTRAINT characters_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table character_groups(
    character_id int not null,
    group_id int not null,
    CONSTRAINT character_fk FOREIGN KEY (character_id)
        REFERENCES "characters" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
);

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
    game_id int not null,
    name varchar(255) not null,
    type variable_type not null,
    player boolean default true,
    public boolean default false,
    ink_name varchar(255),
    base_value text,
    primary key (id),
    unique(name, public, game_id),
    CONSTRAINT variables_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table documents(
    id serial,
    game_id int not null
    name varchar(255) not null,
    code uuid not null default uuid_generate_v4(),
    description text,
    content text,
    primary key (id),
    unique(name, game_id)
    CONSTRAINT documents_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type message_location as ENUM(
    'screen',
    'group',
    'gm',
    'direct',
    'report'
);

create table messages(
    id serial,
    game_id int not null,
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
        ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT mesagages_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table read_messages(
    game_id int not null,
    user_id int not null,
    location message_location not null,
    message_id uuid not null,
    seen timestamp with time zone DEFAULT now(),
    emailed boolean default false,
    primary key (game_id, user_id, location),
    constraint read_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table chat_blocks(
    id serial,
    game_id int not null,
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
    game_id int,
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
        on update no action on delete CASCADE,
    CONSTRAINT chat_reports_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table connections(
    id serial,
    game_id int not null,
    user_id int not null,
    client_id uuid not null,
    server_id varchar(255),
    created timestamp with time zone default now(),
    constraint connection_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table player_triggers(
    player_id int not null,
    trigger_id int not null,
    unique(player_id, trigger_id),
    CONSTRAINT player_fk FOREIGN KEY (player_id)
        REFERENCES "players" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT trigger_fk FOREIGN KEY (trigger_id)
        REFERENCES "triggers" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table meetings(
    id serial,
    game_id int not null,
    meeting_id varchar(20) not null unique,
    name varchar(80) not null,
    description text,
    gm          varchar(255),
    active      boolean default true,
    public      boolean default false,
    show_users  boolean default false,
    screen_id int,
    PRIMARY KEY(id),
    CONSTRAINT meeting_screen_fk FOREIGN KEY (screen_id)
        REFERENCES "screens" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT meetings_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table participants(
    id serial,
    game_id int not null,
    meeting_id int not null,
    user_id int not null,
    joined timestamp with time zone default now(),
    primary key(id),
    constraint participant_meeting_fk foreign key (meeting_id)
        REFERENCES "meetings" (id) match simple
        on update no action on delete CASCADE,
    constraint participant_user_fk foreign key (user_id)
        REFERENCES "users" (id) match simple
        on update no action on delete CASCADE
);

create table inks(
    id serial,
    game_id int not null,
    name varchar(80) not null,
    description text,
    content text,
    compiled json,
    primary key (id),
    CONSTRAINT inks_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table ink_states(
    id serial,
    player_id int not null,
    ink_id int not null,
    state json not null,
    complete boolean default false,
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT player_fk FOREIGN KEY (player_id)
        REFERENCES "players" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT ink_fk FOREIGN KEY (ink_id)
        REFERENCES "inks" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
)

create type function_type as ENUM(
    'conditional',
    'action',
    'ink'
);

create table functions(
    id serial,
    game_id int not null,
    name varchar(80) not null,
    usage varchar(255),
    type function_type not null,
    description text,
    content text,
    primary key (id),
    unique(game_id, name),
    CONSTRAINT functions_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
