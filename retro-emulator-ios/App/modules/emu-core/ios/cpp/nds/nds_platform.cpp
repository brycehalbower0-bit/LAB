// VENDORED COPY — synced by scripts/sync-emu-core.mjs.
// Edit the original and re-run `npm run sync-emu-core`; do not edit here.

// nds_platform.cpp — minimal melonDS Platform:: implementation for
// embedding (headless CI and the iOS module alike). Files are stdio,
// threading is std::thread/mutex, time is chrono; networking, camera,
// microphone, AAC, addons, and dynamic libraries are inert stubs (all
// v1 non-goals per PLAN.md).
//
// WriteNDSSave is the one interesting hook: melonDS calls it on battery
// writes with the userdata passed to the NDS constructor; nds_core.cpp
// uses it to mark the save dirty.

#include <chrono>
#include <condition_variable>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <functional>
#include <mutex>
#include <string>
#include <thread>

// Path-qualified: a bare "Platform.h" collides with ExpoModulesCore's
// framework header of the same name in the iOS pod build.
#include "melonds/src/Platform.h"

// Provided by nds_core.cpp.
void emu_nds_mark_save_dirty(void* userdata);

namespace melonDS::Platform {

void SignalStop(StopReason reason, void* userdata) {
    (void)reason;
    (void)userdata;
}

// --- logging ---

void Log(LogLevel level, const char* fmt, ...) {
    (void)level;
#ifdef EMU_NDS_VERBOSE_LOG
    va_list args;
    va_start(args, fmt);
    std::vfprintf(stderr, fmt, args);
    va_end(args);
#else
    (void)fmt;
#endif
}

// --- files (stdio; local files resolve to CWD, which the shell never
// relies on — ROM/save/state bytes all travel through memory) ---

struct FileHandle {
    FILE* f;
};

static FileHandle* wrap(FILE* f) {
    if (!f) return nullptr;
    FileHandle* h = new FileHandle{f};
    return h;
}

static const char* mode_string(FileMode mode) {
    const bool read = mode & FileMode::Read;
    const bool write = mode & FileMode::Write;
    const bool preserve = mode & FileMode::Preserve;
    const bool append = mode & FileMode::Append;
    if (append) return "ab";
    if (read && write && preserve) return "r+b";
    if (read && write) return "w+b";
    if (write) return "wb";
    return "rb";
}

FileHandle* OpenFile(const std::string& path, FileMode mode) {
    return wrap(std::fopen(path.c_str(), mode_string(mode)));
}

FileHandle* OpenLocalFile(const std::string& path, FileMode mode) {
    return OpenFile(path, mode);
}

std::string GetLocalFilePath(const std::string& filename) {
    return filename;
}

bool FileExists(const std::string& name) {
    FILE* f = std::fopen(name.c_str(), "rb");
    if (!f) return false;
    std::fclose(f);
    return true;
}

bool LocalFileExists(const std::string& name) {
    return FileExists(name);
}

bool CheckFileWritable(const std::string& filepath) {
    FILE* f = std::fopen(filepath.c_str(), "ab");
    if (!f) return false;
    std::fclose(f);
    return true;
}

bool CheckLocalFileWritable(const std::string& filepath) {
    return CheckFileWritable(filepath);
}

bool CloseFile(FileHandle* file) {
    if (!file) return false;
    std::fclose(file->f);
    delete file;
    return true;
}

bool IsEndOfFile(FileHandle* file) {
    return file && std::feof(file->f) != 0;
}

bool FileReadLine(char* str, int count, FileHandle* file) {
    return file && std::fgets(str, count, file->f) != nullptr;
}

u64 FilePosition(FileHandle* file) {
    return file ? (u64)std::ftell(file->f) : 0;
}

bool FileSeek(FileHandle* file, s64 offset, FileSeekOrigin origin) {
    if (!file) return false;
    int whence = origin == FileSeekOrigin::Start ? SEEK_SET
               : origin == FileSeekOrigin::Current ? SEEK_CUR
                                                   : SEEK_END;
    return std::fseek(file->f, (long)offset, whence) == 0;
}

void FileRewind(FileHandle* file) {
    if (file) std::rewind(file->f);
}

u64 FileRead(void* data, u64 size, u64 count, FileHandle* file) {
    return file ? (u64)std::fread(data, (size_t)size, (size_t)count, file->f) : 0;
}

bool FileFlush(FileHandle* file) {
    return file && std::fflush(file->f) == 0;
}

u64 FileWrite(const void* data, u64 size, u64 count, FileHandle* file) {
    return file ? (u64)std::fwrite(data, (size_t)size, (size_t)count, file->f) : 0;
}

u64 FileWriteFormatted(FileHandle* file, const char* fmt, ...) {
    if (!file) return 0;
    va_list args;
    va_start(args, fmt);
    int written = std::vfprintf(file->f, fmt, args);
    va_end(args);
    return written > 0 ? (u64)written : 0;
}

u64 FileLength(FileHandle* file) {
    if (!file) return 0;
    long pos = std::ftell(file->f);
    std::fseek(file->f, 0, SEEK_END);
    long len = std::ftell(file->f);
    std::fseek(file->f, pos, SEEK_SET);
    return (u64)len;
}

// --- threading ---

struct Thread {
    std::thread t;
};

Thread* Thread_Create(std::function<void()> func) {
    return new Thread{std::thread(std::move(func))};
}

void Thread_Free(Thread* thread) {
    if (!thread) return;
    if (thread->t.joinable()) thread->t.detach();
    delete thread;
}

void Thread_Wait(Thread* thread) {
    if (thread && thread->t.joinable()) thread->t.join();
}

struct Semaphore {
    std::mutex m;
    std::condition_variable cv;
    int count = 0;
};

Semaphore* Semaphore_Create() {
    return new Semaphore();
}

void Semaphore_Free(Semaphore* sema) {
    delete sema;
}

void Semaphore_Reset(Semaphore* sema) {
    std::lock_guard<std::mutex> lock(sema->m);
    sema->count = 0;
}

void Semaphore_Wait(Semaphore* sema) {
    std::unique_lock<std::mutex> lock(sema->m);
    sema->cv.wait(lock, [&] { return sema->count > 0; });
    sema->count--;
}

bool Semaphore_TryWait(Semaphore* sema, int timeout_ms) {
    std::unique_lock<std::mutex> lock(sema->m);
    if (!sema->cv.wait_for(lock, std::chrono::milliseconds(timeout_ms),
                           [&] { return sema->count > 0; })) {
        return false;
    }
    sema->count--;
    return true;
}

void Semaphore_Post(Semaphore* sema, int count) {
    std::lock_guard<std::mutex> lock(sema->m);
    sema->count += count;
    sema->cv.notify_all();
}

struct Mutex {
    std::mutex m;
};

Mutex* Mutex_Create() {
    return new Mutex();
}

void Mutex_Free(Mutex* mutex) {
    delete mutex;
}

void Mutex_Lock(Mutex* mutex) {
    mutex->m.lock();
}

void Mutex_Unlock(Mutex* mutex) {
    mutex->m.unlock();
}

bool Mutex_TryLock(Mutex* mutex) {
    return mutex->m.try_lock();
}

// --- time ---

void Sleep(u64 usecs) {
    std::this_thread::sleep_for(std::chrono::microseconds(usecs));
}

u64 GetMSCount() {
    return (u64)std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

u64 GetUSCount() {
    return (u64)std::chrono::duration_cast<std::chrono::microseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

// --- save/firmware write notifications ---

void WriteNDSSave(const u8* savedata, u32 savelen, u32 writeoffset,
                  u32 writelen, void* userdata) {
    (void)savedata;
    (void)savelen;
    (void)writeoffset;
    (void)writelen;
    emu_nds_mark_save_dirty(userdata);
}

void WriteGBASave(const u8* savedata, u32 savelen, u32 writeoffset,
                  u32 writelen, void* userdata) {
    (void)savedata;
    (void)savelen;
    (void)writeoffset;
    (void)writelen;
    (void)userdata;
}

void WriteFirmware(const Firmware& firmware, u32 writeoffset, u32 writelen,
                   void* userdata) {
    (void)firmware;
    (void)writeoffset;
    (void)writelen;
    (void)userdata;
}

void WriteDateTime(int year, int month, int day, int hour, int minute,
                   int second, void* userdata) {
    (void)year; (void)month; (void)day;
    (void)hour; (void)minute; (void)second;
    (void)userdata;
}

// --- local multiplayer (v1 non-goal: inert) ---

void MP_Begin(void* userdata) { (void)userdata; }
void MP_End(void* userdata) { (void)userdata; }
int MP_SendPacket(u8*, int, u64, void*) { return 0; }
int MP_RecvPacket(u8*, u64*, void*) { return 0; }
int MP_SendCmd(u8*, int, u64, void*) { return 0; }
int MP_SendReply(u8*, int, u64, u16, void*) { return 0; }
int MP_SendAck(u8*, int, u64, void*) { return 0; }
int MP_RecvHostPacket(u8*, u64*, void*) { return -1; }
u16 MP_RecvReplies(u8*, u64, u16, void*) { return 0; }

// --- network (v1 non-goal: inert) ---

int Net_SendPacket(u8*, int, void*) { return 0; }
int Net_RecvPacket(u8*, void*) { return 0; }

// --- camera / mic (v1 non-goals: silence) ---

void Camera_Start(int, void*) {}
void Camera_Stop(int, void*) {}
void Camera_CaptureFrame(int, u32*, int, int, bool, void*) {}

void Mic_Start(void*) {}
void Mic_Stop(void*) {}
int Mic_ReadInput(s16* data, int maxlength, void*) {
    if (data && maxlength > 0) std::memset(data, 0, (size_t)maxlength * sizeof(s16));
    return 0;
}

// --- DSi AAC (DSi is a v1 non-goal) ---

AACDecoder* AAC_Init() { return nullptr; }
void AAC_DeInit(AACDecoder*) {}
bool AAC_Configure(AACDecoder*, int, int) { return false; }
bool AAC_DecodeFrame(AACDecoder*, const void*, int, void*, int) { return false; }

// --- slot-2 addons (v1 non-goal) ---

bool Addon_KeyDown(KeyType, void*) { return false; }
void Addon_RumbleStart(u32, void*) {}
void Addon_RumbleStop(void*) {}
float Addon_MotionQuery(MotionQueryType, void*) { return 0.0f; }

// --- dynamic libraries (never used on iOS) ---

DynamicLibrary* DynamicLibrary_Load(const char*) { return nullptr; }
void DynamicLibrary_Unload(DynamicLibrary*) {}
void* DynamicLibrary_LoadFunction(DynamicLibrary*, const char*) { return nullptr; }

} // namespace melonDS::Platform
