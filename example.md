# ft_script

`ft_script` is a C implementation of the UNIX `script` command. It records a
terminal session in a file while the user continues to work normally.

Think of it as a text-only screen recorder. A video recorder saves pictures of
the screen; `ft_script` saves the commands and text that pass through the
terminal.

## What does `script` do?

A terminal normally connects your keyboard directly to a shell such as `sh`,
`bash`, or `zsh`. The shell reads what you type and prints its answers back to
the terminal.

`ft_script` places itself between the terminal and the shell:

```text
keyboard -> ft_script -> shell
terminal <- ft_script <- shell
                |
                +----> log file
```

Everything printed by the shell still appears on the screen, but a copy is
also written to a file. The default file is named `typescript`.

For example:

```sh
./ft_script
echo "hello"
pwd
exit
```

The terminal behaves normally during the session. After `exit`, the
`typescript` file contains the recorded conversation.

```sh
cat typescript
```

## A few basic words

- **Terminal:** the window where a user types commands.
- **Shell:** the program that understands commands such as `cd`, `echo`, and
  `ls`.
- **Process:** a program that is currently running.
- **File descriptor:** a small number used by a process to refer to an open
  file, terminal, or pipe.
- **PTY (pseudo-terminal):** a fake terminal created by a program. It makes the
  shell believe that it is connected to a normal interactive terminal.

## How does `ft_script` work?

When `ft_script` starts, it opens the requested log files and creates a PTY.
The PTY has two ends:

- The **master** end is controlled by `ft_script`.
- The **slave** end behaves like a real terminal and is given to the shell.

The program then calls `fork()`. This creates two processes:

- The **child process** connects the PTY slave to its input, output, and error
  streams. It then starts the user's shell or requested command with
  `execve()`.
- The **parent process** keeps the PTY master. It copies keyboard input to the
  child and copies the child's output to both the screen and the log file.

The parent uses `poll()` so it can wait for keyboard input and child output at
the same time. It also temporarily puts the real terminal in raw mode. This
allows special keys and interactive programs to pass through without being
changed by the outer terminal.

The main data flow is:

```text
real stdin  -> PTY master -> PTY slave -> shell stdin
real stdout <- PTY master <- PTY slave <- shell stdout/stderr
log file    <- PTY master
```

When the shell exits, `ft_script` drains the remaining output, restores the
original terminal settings, writes the final log message, closes its files,
and returns the appropriate exit status.

## Signals and terminal safety

The program handles terminal resizing and common exit signals.

- `SIGWINCH` copies the new window size to the PTY.
- `SIGCHLD` reports that the child process has finished.
- `SIGINT`, `SIGTERM`, and `SIGHUP` stop the session safely.

The original terminal configuration is restored before the program exits. This
prevents the user's terminal from being left without normal echo or line
editing.

## Project requirements

- The executable is named `ft_script`.
- The project is written in C.
- A `Makefile` builds the program.
- Errors are handled without unexpected crashes.
- Only functions documented in manual section 2 are used.
- `ctime()` is the one explicitly allowed exception.

The subject requires the options provided by the local `script(1)` command,
with the following mandatory/bonus split:

- macOS mandatory: every option except `-k` and `-t`.
- macOS bonus: `-k` and `-t`.
- Linux mandatory: every option except `-f` and `-m`.
- Linux bonus: `-f` and `-m`.

The exact native behavior can be inspected with:

```sh
man script
```

## Building and using the program

Build the executable:

```sh
make
```

Start a session using the default `typescript` file:

```sh
./ft_script
```

Record into a chosen file:

```sh
./ft_script session.log
```

Append to an existing file:

```sh
./ft_script -a session.log
```

Run and record one command on Linux:

```sh
./ft_script -c "echo hello" session.log
```

On macOS, use the native positional command grammar:

```sh
./ft_script session.log /bin/sh -c "echo hello"
```

Use quiet mode:

```sh
./ft_script -q session.log
```

The other supported options follow the local Linux or macOS `script` manual.

## Platform Strategy

Linux and macOS provide different `script` options and use different PTY
operations. The shared recorder stays the same, while platform-specific code is
selected at compile time.

The platform is detected in `include/core/defines.h`:

```c
#if defined(__APPLE__) && defined(__MACH__)
# define FT_OS_DARWIN 1
#elif defined(__linux__)
# define FT_OS_LINUX 1
#else
# error "Unsupported platform"
#endif
```

Platform guards keep an option or implementation on the correct operating
system:

```c
#if FT_OS_DARWIN
/* macOS-only options and behavior */
#endif

#if FT_OS_LINUX
/* Linux-only options and behavior */
#endif
```

The `Makefile` also selects the matching PTY source file:

- `src/platform/darwin.c` on macOS
- `src/platform/linux.c` on Linux

Shared code handles session files, process creation, input/output forwarding,
signals, and terminal restoration. This prevents Linux-specific behavior from
changing the macOS build, and vice versa.

## Testing and native comparison

Run the test suite from a real terminal:

```sh
./run.sh
```

The script detects Linux or macOS automatically. It builds the project, tests
the options for that platform, and compares `ft_script` with the original
`script` command.

`run.sh` is the only test entry point and sources focused modules from
`scripts/`:

- `common.sh`: output, command and comparison helpers;
- `preflight.sh`: Makefile, parsing and PTY checks;
- `session.sh`: behavior shared by Linux and macOS;
- `linux.sh` and `darwin.sh`: native platform flags;
- `native.sh`: byte-for-byte comparisons with `script`.

The Linux comparison output uses different colors for:

- the native `script` command;
- the `ft_script` command;
- the expected output produced by native `script`;
- the output produced by `ft_script`;
- the final pass or failure result.

On both Linux and macOS, transcript files are compared byte for byte with
`cmp`. The macOS suite additionally checks every native recording flag,
cross-plays native and `ft_script` raw recordings, verifies timestamp reports,
and confirms that bonus `-t` has macOS flush semantics rather than Linux timing
semantics. `run.sh` is the single test entry point: `make test-macos` and
`make test-linux` both invoke it after checking the local platform, while
`make test` selects the local platform automatically.
