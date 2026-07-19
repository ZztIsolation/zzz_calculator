const FUNCTIONS = {
    floor: { arity: 1, fn: Math.floor },
    ceil: { arity: 1, fn: Math.ceil },
    round: { arity: 1, fn: Math.round },
    min: { minArity: 1, fn: (...values) => Math.min(...values) },
    max: { minArity: 1, fn: (...values) => Math.max(...values) },
    clamp: { arity: 3, fn: (value, min, max) => Math.max(min, Math.min(max, value)) },
}

function tokenize(expression) {
    const tokens = []
    let index = 0

    while (index < expression.length) {
        const char = expression[index]
        if (/\s/.test(char)) {
            index += 1
            continue
        }

        if (/[0-9.]/.test(char)) {
            const start = index
            index += 1
            while (index < expression.length && /[0-9.]/.test(expression[index])) {
                index += 1
            }
            const raw = expression.slice(start, index)
            if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
                throw new Error(`Invalid number: ${raw}`)
            }
            tokens.push({ type: "number", value: Number(raw) })
            continue
        }

        if (/[A-Za-z_]/.test(char)) {
            const start = index
            index += 1
            while (index < expression.length && /[A-Za-z0-9_]/.test(expression[index])) {
                index += 1
            }
            tokens.push({ type: "identifier", value: expression.slice(start, index) })
            continue
        }

        if ("+-*/(),".includes(char)) {
            tokens.push({ type: char, value: char })
            index += 1
            continue
        }

        throw new Error(`Unsupported character: ${char}`)
    }

    tokens.push({ type: "eof" })
    return tokens
}

class Parser {
    constructor(expression, variables) {
        this.tokens = tokenize(expression)
        this.index = 0
        this.variables = variables
    }

    current() {
        return this.tokens[this.index]
    }

    match(type) {
        if (this.current().type !== type) {
            return false
        }
        this.index += 1
        return true
    }

    expect(type) {
        if (!this.match(type)) {
            throw new Error(`Expected ${type}, got ${this.current().type}`)
        }
    }

    parse() {
        const value = this.parseExpression()
        this.expect("eof")
        return value
    }

    parseExpression() {
        let value = this.parseTerm()
        while (this.current().type === "+" || this.current().type === "-") {
            const operator = this.current().type
            this.index += 1
            const right = this.parseTerm()
            value = operator === "+" ? value + right : value - right
        }
        return value
    }

    parseTerm() {
        let value = this.parseUnary()
        while (this.current().type === "*" || this.current().type === "/") {
            const operator = this.current().type
            this.index += 1
            const right = this.parseUnary()
            value = operator === "*" ? value * right : value / right
        }
        return value
    }

    parseUnary() {
        if (this.match("+")) {
            return this.parseUnary()
        }
        if (this.match("-")) {
            return -this.parseUnary()
        }
        return this.parsePrimary()
    }

    parsePrimary() {
        const token = this.current()
        if (token.type === "number") {
            this.index += 1
            return token.value
        }

        if (token.type === "identifier") {
            this.index += 1
            if (this.match("(")) {
                return this.parseCall(token.value)
            }
            if (!Object.hasOwn(this.variables, token.value)) {
                throw new Error(`Unknown variable: ${token.value}`)
            }
            return Number(this.variables[token.value])
        }

        if (this.match("(")) {
            const value = this.parseExpression()
            this.expect(")")
            return value
        }

        throw new Error(`Unexpected token: ${token.type}`)
    }

    parseCall(name) {
        const fn = FUNCTIONS[name]
        if (!fn) {
            throw new Error(`Unsupported function: ${name}`)
        }

        const args = []
        if (!this.match(")")) {
            do {
                args.push(this.parseExpression())
            } while (this.match(","))
            this.expect(")")
        }

        if (fn.arity != null && args.length !== fn.arity) {
            throw new Error(`${name} expects ${fn.arity} arguments`)
        }
        if (fn.minArity != null && args.length < fn.minArity) {
            throw new Error(`${name} expects at least ${fn.minArity} argument`)
        }

        return fn.fn(...args)
    }
}

export function evaluateFormulaExpression(expression, variables = {}) {
    const text = String(expression ?? "").trim()
    if (!text) {
        throw new Error("Formula expression is required")
    }
    const value = new Parser(text, variables).parse()
    if (!Number.isFinite(value)) {
        throw new Error("Formula result must be a finite number")
    }
    return value
}

export function validateFormulaExpression(expression, allowedVariables = new Set(["x"])) {
    const variables = Object.fromEntries([...allowedVariables].map(name => [name, 1]))
    evaluateFormulaExpression(expression, variables)
}
