#!lua name=jredlib

-- ASSUMPTION: All keys are unique - the compiler is responsible for this check
-- The keys are the variable names - so we need to have unique names

-- configuration variables - these can changed by the config function
local DFLOW_BUFFER_SIZE = 200
local UFLOW_BUFFER_SIZE = 200
local DFLOW_SIZE = 2000
local UFLOW_SIZE = 2000
local UWRITER_COUNT = 1000

-- non configuration variables
local MAX_CLOCK_AGE = 5

-- configure the "global" variables (these variables are not in Redis)
local function config(keys, args)
    local cmd = args[1]
    if (cmd == "dflow_buffer") then
        if (arg[2] == nil) then 
            return DFLOW_BUFFER_SIZE
        else
            DFLOW_BUFFER_SIZE = tonumber(args[2])
        end
    elseif (cmd == "uflow_buffer") then
        if (arg[2] == nil) then 
            return UFLOW_BUFFER_SIZE
        else 
            UFLOW_BUFFER_SIZE = tonumber(args[2])
        end
    elseif (cmd == "uflow") then 
        if (arg[2] == nil) then 
            return UFLOW_SIZE
        else 
            UFLOW_SIZE = tonumber(args[2])
        end
    elseif (cmd == "dflow") then
        if (arg[2] == nil) then 
            return DFLOW_SIZE
        else 
            DFLOW_SIZE = tonumber(args[2])
        end
    elseif (cmd == "uwriter_count") then 
        if (arg[2] == nil) then 
            return UWRITER_COUNT
        else 
            UWRITER_COUNT = tonumber(args[2])
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
-- Main State Table
-- This is used to maintain global state about the uflows (here we have multiple writers)
-- We want to avoid doing a redis call (this somewhat expensive) so we are keeping soft state 
-- in a Lua table
--
-- One entry for each flow (we use the key - variable name - to index)
--
-- The entry for the flow will have the following information: number of elements, 



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
    local clock = tonumber(args[1])
    local id = args[2]
    local width = tonumber(args[3])
    local xcoord = args[4]
    local ycoord = args[5]
    local value = args[6]
    -- get expected writers - if width is 0, we set the number of active writers as expected
    -- NOTE: the width specification solves an important problem - we can materialize streams that have irregular width 
    -- we expect the outside program to specify what the width should be
    local expected
    if (width > 0) then 
        expected = width
    else
        expected = get_expected()
    end
    local ssres = redis.call('ZRANGE', ksset, clock, clock, 'BYSCORE')
    if (#ssres == 0) then 
        local hindx = redis.call('HINCRBY', khash, 'counter', 1)
        local ssres = redis.call('ZADD', ksset, clock, k..'###'..hindx)
        redis.call('HSET', k..'###'..hindx, 'expected', expected, 'count', 1, 'id###'..id, id, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)
        if (writer_count == 1) then 
            -- put it in the completed list and signal.. there is nothing more to expect
            redis.call('RPUSH', kcomp, k..'###'..hindx)
            redis.call('PUBLISH', "__keycompleted", k)
        else
            -- put it in the expected list.. we have more writers to come
            redis.call('RPUSH', kpend, k..'###'..hindx)
            set_pending(k, clock)
        end
    else
        redis.call('HSET', ssres[1], 'id###'..id, id, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)
        local tcount = redis.call('HINCRBY', ssres[1], 'count', 1)
        local texpect = redis.call('HGET', ssres[1], 'expected')
        texpect =tonumber(texpect)
        -- we have all writers arrived (the expected number), now we move the element from expected to completed 
        -- the signalling is implicit.. we are watching for 'completed' key modifications..
        if (tcount >= texpect) then 
            redis.call('LREM', kpend, 1, ssres[1]) 
            redis.call('RPUSH', kcomp, ssres[1])
            redis.call('PUBLISH', "__keycompleted", k)
        end
    end
    -- update the size of the flow
    local fsize = upsize(k)
    -- if the size is too large, trim the flow
    -- if (fsize > UFLOW_SIZE) then trim_flow(ksset, UFLOW_BUFFER_SIZE) end
    -- if (is_pending(clock)) then  flush_pending(clock) end
end


local function log(value) 
    redis.call('SET', 'log', value)
end

--
-- SUB FUNCTIONS used by uf_write
-- 

local pending_clk = 0
local pending_writes = {}

local function set_pending(key, newclk) 
    if (pending_clk == 0) then pending_clk = newclk end 
    if (pending_writes[key] == nil) then 
        local ptab = {}
        ptab[#ptab + 1] = newclk
        pending_writes[key] = ptab 
    else 
        local ptab = pending_writes[key]
        ptab[#ptab + 1] = newclk
    end
end

local function flush_pending(clk) 
    for key, pt in pairs(pending_writes) do 
        if (clk - pt[1] > PENDING_TOO_OLD) then 
            table.remove(pt, 1)
            local kpend = key..'###pending'
            local kcomp = key..'###complete'
            local rec = redis.call('LPOP', kpend, 1)
            redis.call('RPUSH', kcomp, rec)
            redis.call('PUBLISH', "__keycompleted", key)
        end
    end
    local pclk = clk
    for key, pt in pairs(pending_writes) do 
        if (#pt > 0 and pt[1] < pclk) then
            pclk = pt[1]
        end 
    end 
    pending_clk = pclk
end

-- calculate the pending_age
--
local function is_pending(newclk)
    if (newclk - pending_clk) > PENDING_TOO_OLD then 
        return true
    else 
        return false
    end
end

-- maintain the size of the different uflows 

local uflow_sizes = {}

local function upsize(k) 
    if (uflow_sizes[k] == nil) then 
        uflow_sizes[k] = 1
    else
        uflow_sizes[k] = uflow_sizes[k] + 1
    end
    return uflow_sizes[k]
end

local active_writers = {}
local max_clock = 0

--
-- get_expected: return the number of writers we can expect
-- we are counting the unique writers that showed up in the last MAX_CLOCK_AGE
-- time window
--
local function get_expected(id, clk)
    active_writers[id] = clk
    max_clock = math.max(clk, max_clock)
    local count = 0
    for wid, clk in pairs(active_writers) do
        if (max_clock - clk) < MAX_CLOCK_AGE then
            count = count + 1
        else
            active_writers[wid] = nil
        end
    end
    return count;
end

local function testme() 
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
    local clock = tonumber(args[1])
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
    local klist = k..'###complete'
    local len = redis.call('LLEN', klist)
    if (len > 0) then 
        local ssres = redis.call('RPOP', klist, 1)
        return redis.call('HGETALL', ssres[1])
    else 
        return {}
    end
end 

-- get the first element of the completed list
local function uf_fread(keys, args) 
    local k = keys[1]
    local klist = k..'###complete'
    local ssres = redis.call('LPOP', klist, 1)
    if (#ssres == 0) then 
        return ssres
    else 
        return redis.call('HGETALL', ssres[1])
    end
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
    local clock = tonumber(args[1])
    local id = args[2]
    local xcoord = args[3]
    local ycoord = args[4]
    local value = args[5]
    local hindx = redis.call('HINCRBY', khash, 'counter', 1)
    local ssres = redis.call('ZADD', kcomp, clock, k..'###'..hindx)
    redis.call('HSET', k..'###'..hindx, 'id###'..id, id, 'xcoord###'..id, xcoord, 'ycoord###'..id, ycoord, 'value###'..id, value)
    redis.call('PUBLISH', '__d__keycompleted', k)

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
redis.register_function('testme', testme)
redis.register_function('get_id', get_id)
redis.register_function('uf_write', uf_write)
redis.register_function('uf_fread', uf_fread)
redis.register_function('uf_lread', uf_lread)
redis.register_function('uf_randread', uf_randread)
redis.register_function('df_write', df_write)
redis.register_function('df_fread', df_fread)
redis.register_function('df_lread', df_lread)
