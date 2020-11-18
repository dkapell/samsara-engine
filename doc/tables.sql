create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id  varchar(500),
    is_admin   boolean default false,
    is_creator boolean default false,
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

create table gamestates (
    id serial,
    name varchar(255) not null,
    description text,
    imagemap_id int,
    allow_codes boolean,
    primary key (id),
    CONSTRAINT gamestate_imagemap_fk FOREIGN KEY (imagemap_id)
        REFERENCES "imagemaps" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
);

insert into gamestates (name) values ('Initial');

create table gamestate_rooms(
    gamestate_id int not null,
    room_id int not null,
    primary key (gamestate_id, room_id),
    CONSTRAINT gsr_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT gsr_room_fk FOREIGN KEY (room_id)
        REFERENCES "rooms" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table transitions(
    id serial,
    from_state_id int not null,
    to_state_id int not null,
    group_id int,
    room_id int,
    delay int default 0,
    primary key(id),
    CONSTRAINT transitions_from_fk FOREIGN KEY (from_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_to_fk FOREIGN KEY (to_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_group_fk FOREIGN KEY (group_id)
        REFERENCES "player_groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
     CONSTRAINT transitions_room_fk FOREIGN KEY (room_id)
        REFERENCES "rooms" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table players (
    id          serial,
    user_id     int,
    run_id      int,
    group_id    int,
    character   varchar(255),
    gamestate_id int,
    prev_gamestate_id int,
    statetime timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT players_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_run_fk FOREIGN KEY (run_id)
        REFERENCES "runs" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_group_fk FOREIGN KEY (group_id)
        REFERENCES "player_groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT players_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT players_prev_gamestate_fk FOREIGN KEY (prev_gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
);

create table images (
    id  serial,
    name varchar(255) not null,
    description text,
    status varchar(20) default 'new' not null,
    primary key (id)
);

create table imagemaps (
    id  serial,
    name varchar(255) not null,
    description text,
    image_id int not null,
    map jsonb,
    primary key(id),
    CONSTRAINT imagemaps_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

