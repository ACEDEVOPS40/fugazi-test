export function isValidUsername(username) {
    return username && username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

export function isValidPassword(password) {
    return password && password.length >= 6;
}
