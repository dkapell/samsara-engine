create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id  varchar(500),
    is_admin   boolean default false,
    is_gm boolean default false,
    is_player boolean default false,
    PRIMARY KEY (id)
);

create table rooms (
    id          serial,
    name        varchar(80) not null,
    code        varchar(20) not null unique,
    description text,
    url         varchar(255) not null,
    gm          varchar(255),
    active      boolean default true,
    primary key (id)
);

create table runs (
    id          serial,
    name        varchar(80) not null unique,
    current     boolean default false,
    primary key(id)
);

create table player_groups (
    id          serial,
    name        varchar(80) not null unique,
    description text
    primary key (id),
);

create table players (
    id          serial,
    user_id     int,
    run_id      int,
    group_id    int,
    character   varchar(255),
    game_state  varchar(80),
    primary key (id),
    CONSTRAINT players_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_run_fk FOREIGN KEY (run_id)
        REFERENCES "runs" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_group_fk FOREIGN KEY (group_id)
        REFERENCES "player_groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table images (
    id  serial,
    name varchar(255) not null,
    description text,
    status varchar(20) default 'new' not null,
    primary key (id)
);
