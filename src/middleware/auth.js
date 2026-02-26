import { verifyToken } from "../auth/auth.js";

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if(!authHeader) {
        return res.status(401).json({
            error: "Token não fornecido"
        });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if(!decoded) {
        return res.status(401).json({
            error: "Token inválido"
        });
    }

    req.user = decoded;
    
    next();
}