create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id  varchar(500) not null,
    is_admin   boolean default false,
    is_gm boolean default false,
    PRIMARY KEY (id)
);

