# Deadlines order the Schedule; Priority decides who misses

The scheduler places Tasks earliest-deadline-first. When Tasks compete for the same time, a higher-Priority Task goes first only as long as no other Task is pushed past its deadline. When a missed deadline can't be avoided, the lower-Priority Task misses. We rejected pure Priority-first ordering because it lets a Critical Task with a far-off deadline crowd out a Low Task due today. We also rejected pure deadline-first ordering because it ignores Priority exactly when Priority matters most: when there isn't time for everything.
