#!lua name=jredlib

-- ASSUMPTION: All keys are unique - the compiler is responsible for this check
--

-- configuration variables - these can changed by the config function
local DFLOW_BUFFER_SIZE = 200
local UFLOW_BUFFER_SIZE = 200
local DFLOW_SIZE = 2000
local UFLOW_SIZE = 2000
local CLOCK_WINDOW = 50
local UWRITER_COUNT = 10

-- configure the "global" variables (these variables are not in Redis)
local function config(keys, args)
    local cmd = args[1]
    if (cmd == "dflow_buffer") then
        if (arg[2] == nil) then 
            return DFLOW_BUFFER_SIZE
        else
            DFLOW_BUFFER_SIZE = args[2]
        end
    elseif (cmd == "uflow_buffer") then
        if (arg[2] == nil) then 
            return UFLOW_BUFFER_SIZE
        else 
            UFLOW_BUFFER_SIZE = args[2]
        end
    elseif (cmd == "uflow") then 
        if (arg[2] == nil) then 
            return UFLOW_SIZE
        else 
            UFLOW_SIZE = args[2]
        end
    elseif (cmd == "dflow") then
        if (arg[2] == nil) then 
            return DFLOW_SIZE
        else 
            DFLOW_SIZE = args[2]
        end
    elseif (cmd == "clock_window") then
        if (arg[2] == nil) then 
            return CLOCK_WINDOW
        else 
            CLOCK_WINDOW = args[2]
        end
    elseif (cmd == "uwriter_count") then 
        if (arg[2] == nil) then 
            return UWRITER_COUNT
        else 
            UWRITER_COUNT = args[2]
        end
    end
end

-- this is maintaining a persistent table for the connected nodes and maintaining 
-- an entry for each node. the node-counter would give us the total number of 
-- that got connected to the system. it won't be the current number of nodes
-- at any given time
local function get_id(keys, args)
    local s = args[1]
    local v = redis.call('HGET', 'node-ids', s)
    if (v == false) then 
        local cntr = redis.call('HINCRBY', 'node-ids', 'node-counter', 1)
        redis.call('HSET', 'node-ids', s, cntr)
        return tonumber(cntr)
    else 
        return tonumber(v)
    end 
end

-- 
-- INSERT ISSUE
--
-- lookup entry in the sorted set using the score (jamclock) - if found, we can go and update the hashmap
-- with the element. otherwise, we put a new entry into the sorted set. the element we insert into the sorted set has 
-- to be unique (because sorted set is a set - duplicates are not stored - in this case we want all writes to be stored).
-- we generate a unique making index for each entry. entry key (key + special index) is stored in the sorted set.
-- the actual value is stored in a hash table. We check if the set has more than K elements 
-- we need to remove one element if there are more than K elements, the element needs to be removed from 
-- hashmap as well. This is done without relying on Redis for eviction. We need to keep the length of the data structure 
-- limited so that the insertion, deletion, and search times are small. 
--
-- RELEASE ISSUE: 
-- 
-- We have a complete list of entries. Key###Complete is the list name. We have a FIFO list and use that to exchange the entries.
-- To detect whether a row is complete or not, is little complicated. We maintain a counter on the number of entries in each row.
-- We read the last score-N entries. If there are no entries, we wait for 1. If there are entries, we find the second maximum number 
-- of elements in those rows - if all the numbers are the same, we wait for that number. Otherwise, we select the second largest 
-- number among them.
-- 
--
local clkat_wcount = 0
local writer_count = 1

local function uf_write(keys, args) 
    local k = keys[1]
    local ksset = k..'###sset'
    local khash = k..'###hash'
    local kcomp = k..'###complete'
    local kpend = k..'###pending'
    local clock = args[1]
    local id = args[2]
    local scope = args[3]
    local xcoord = args[4]
    local ycoord = args[5]
    local value = args[6]
    if (clock > clkat_wcount) then 
        get_writer_count(ksset, clock)
    end
    local ssres = redis.call('ZRANGE', ksset, clock, clock, 'BYSCORE')
    if (#ssres == 0) then 
        local hindx = redis.call('HINCRBY', khash, 'counter', 1)
        local ssres = redis.call('ZADD', ksset, clock, k..'###'..hindx)
        redis.call('HSET', k..'###'..hindx, 'expected', writer_count, 'count', 1, 'id###'..id, id, 'scope###'..id, scope, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)
        if (writer_count == 1) then 
            -- put it in the completed list.. there is nothing more to expect
            redis.call('RPUSH', kcomp, k..'###'..hindx)
        else
            -- put it in the expected list.. we have more writers to come
            redis.call('RPUSH', kpend, k..'###'..hindx)
        end
    else
        redis.call('HSET', ssres[1], 'id###'..id, id, 'scope###'..id, scope, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)
        redis.call('HINCRBY', ssres[1], 'count', 1)
        local tcount = redis.call('HGET', ssres[1], 'count')
        local texpect = redis.call('HGET', ssres[1], 'expected')
        -- we have all writers arrived (the expected number), now we move the element from expected to completed 
        -- the signalling is implicit.. we are watching for 'completed' key modifications..
        if (tcount >= texpect) then 
            redis.call('LREM', kpend, 1, k..'###'..hindx)
            redis.call('RPUSH', kcomp, k..'###'..hindx)
        end
    end
    local size = redis.call('ZCARD', ksset)
    if (size > UFLOW_SIZE) then 
        trim_flow(ksset, UFLOW_BUFFER_SIZE)
    end
end


-- SUB FUNCTIONS used by fl_write
-- 

-- get_writer_count: look at the previous rows of the stream and figure out the number of writers
-- we get 


local function get_writer_count(ks, clk)
    local res = redis.call('ZRANGE', ks, clk - CLOCK_WINDOW, clk-1, 'BYSCORE')
    local mvalue = 1
    local smvalue = 1
    clkat_wcount = clk
    if (#res > 0) then 
        local count = math.min(#res, UWRITER_COUNT)
        for i = 1, count do
            local val = redis.call('HGET', res[#res - i], 'count')
            if (val > mvalue) then 
                mvalue = val
                smvalue = mvalue
            elseif (val > smvalue) then 
                smvalue = val 
            end 
        end
    end 
    writer_count = smvalue
end

local function trim_flow(ks, count)
    local pelems = redis.call('ZPOPMIN', ksset, count)
    if (#pelems > 0) then 
        for i = 1, #pelems do 
            local fields = redis.call('HKEYS', pelems[i])  -- this hack has not problem.. we cannot have large uflow and have ssres nil
            redis.call('HDEL', pelems[i], fields)
        end
    end
end

-- get the element at a particular score value for a key (variable name)
local function uf_randread(keys, args) 
    local k = keys[1]
    local ksset = k..'###sset'
    local khash = k..'###hash'
    local clock = args[1]
    local ssres = redis.call('ZRANGE', ksset, clock, clock, 'BYSCORE')
    if (#ssres == 0) then 
        return ssres
    else 
        return redis.call('HGETALL', ssres[1])
    end
end 

-- get the last element of the completed list
local function uf_lread(keys, args) 
    local k = keys[1]
    local klist = k..'###list'
    local ssres = redis.call('RPOP', klist, 1)
    return redis.call('HGETALL', ssres[1])
end 

-- get the first element of the completed list
local function uf_fread(keys, args) 
    local k = keys[1]
    local klist = k..'###list'
    local ssres = redis.call('LPOP', klist, 1)
    return redis.call('HGETALL', ssres[1])
end 

-- we just write the new entry. get a new ID by incrementing the counter in the hash table - "k###hash"
-- use the counter value to create k###hindx (where hindx is the counter value)
-- we store the actual fields and values in the hash table.
--
-- there is a slight complication here. we assume that the different fogs have their own data stores.
-- otherwise, we will have multiple writers to the dflow which would break our assumption over here.
--
local function df_write(keys, args) 
    local k = keys[1]
    local kcomp = k..'###complete'
    local khash = k..'###hash'
    local clock = args[1]
    local id = args[2]
    local scope = args[3]
    local xcoord = args[4]
    local ycoord = args[5]
    local value = args[6]

    local hindx = redis.call('HINCRBY', khash, 'counter', 1)
    local ssres = redis.call('ZADD', kcomp, clock, k..'###'..hindx)
    redis.call('HSET', k..'###'..hindx, 'id###'..id, id, 'scope###'..id, scope, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)

    local size = redis.call('ZCARD', kcomp)
    if (size > DFLOW_SIZE) then 
        trim_flow(kcomp, DFLOW_BUFFER_SIZE)
    end
end

-- always go to the end of the dflow. So, a slow reader can skip many elements in the stream. 
-- the reader is trying to keep up with the stream. no need to maintain the read pointer for this mode of reading.
--
--
local function df_lread(keys, args) 
    local k = keys[1]
    local kcomp = k..'###complete'
    local ssres = redis.call('ZRANGE', kcomp, 0, 0, 'REV')
    return redis.call('HGETALL', ssres[1])
end 

-- maintain a per reader stream location. 
-- At every df_fread() we get the data (this should be there - because we are launching the df_fread in response to notifications) 
-- and then we put the next score in the per reader table. This way we can seek to that location and read the next data and then 
-- put the next score in the table again. This allows us to keep reading in a continuous manner unless the reader is too slow or 
-- goes to sleep - in that case, the writer would have advanced the stream by too much so that the reader misses some of the 
-- rows - data items.
--

local function df_fread(keys, args) 
    local k = keys[1]
    local id = args[1]
    local kcomp = k..'###complete'
    -- check the cursorget cursor for the key and if it is nil
    local record = nil
    if (dflows[kcomp] == nil) then 
        -- no cursor for the flow.. 
        local res = redis.call('ZRANGE', kcomp, 0, 1, 'WITHSCORES')
        dflows[kcomp] = {}
        if (#res == 4) then 
            dflows[kcomp][id] = res[3]
        end
        return redis.call('HGETALL', res[1])
    elseif (dflows[kcomp][id] == nil) then 
        -- no cursor there.. but the table is there.. so don't initialize it
        local res = redis.call('ZRANGE', kcomp, 0, 1, 'WITHSCORES')
        if (#res == 4) then 
            dflows[kcomp][id] = res[3]
        end
        return redis.call('HGETALL', res[1])
    else
        -- we are calling the df_fread() in response to message event .. so there is a new data item everytime 
        -- we don't worry about an end-of-stream problem.. it is a bug if we get into this problem
        --
        local nscore = dflows[kcomp][id]
        local res = redis.call('ZRANGE', kcomp, nscore, nscore + SEARCH_WINDOW, 'BYSCORE')
        if (#res >= 4) then 
            dflows[kcomp][id] = res[3]
        end
        -- if are unable to read at least 2 values (4 with scores), we keep reading the old ones 
        -- this is an error condition
        return redis.call('HGETALL', res[1])
    end 
end 


redis.register_function('config', config)
redis.register_function('get_id', get_id)
redis.register_function('uf_write', uf_write)
redis.register_function('uf_fread', uf_fread)
redis.register_function('uf_lread', uf_lread)
redis.register_function('uf_randread', uf_randread)
redis.register_function('df_write', df_write)
redis.register_function('df_fread', df_fread)
redis.register_function('df_lread', df_lread)
