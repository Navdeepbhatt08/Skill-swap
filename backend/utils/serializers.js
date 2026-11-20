function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    avatar: user.avatar,
    teaches: user.teaches,
    learns: user.learns,
    available: user.available,
    availability: user.availability || [],
    bookmarks: (user.bookmarks || []).map((bookmark) => String(bookmark._id || bookmark)),
    mentorCapacity: user.mentorCapacity ?? 3,
    whatsapp: user.whatsapp || "",
    bio: user.bio || "",
    profileImage: user.profileImage || "",
  };
}

function publicMessage(message) {
  return {
    id: message._id,
    from: message.from,
    to: message.to,
    text: message.text,
    resource: message.resource || null,
    createdAt: message.createdAt,
    readAt: message.readAt,
  };
}

function publicReview(review) {
  return {
    id: review._id,
    sessionId: review.session?._id || review.session,
    reviewer: review.reviewer?._id || review.reviewer,
    reviewerName: review.reviewer?.name || "SkillSwap learner",
    reviewee: review.reviewee?._id || review.reviewee,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

function publicSession(session) {
  return {
    id: session._id,
    requester: session.requester?._id || session.requester,
    requesterName: session.requester?.name,
    recipient: session.recipient?._id || session.recipient,
    recipientName: session.recipient?.name,
    skill: session.skill,
    title: session.title || "",
    description: session.description || "",
    startAt: session.startAt,
    endAt: session.endAt,
    status: session.status,
    reviewed: Boolean(session.reviewed),
    reviews: (session.reviews || []).map(publicReview),
  };
}

module.exports = { publicUser, publicMessage, publicReview, publicSession };
